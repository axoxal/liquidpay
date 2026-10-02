// SPDX-License-Identifier: Apache-2.0
// Ported from Flowpay SmsTransactionParser.kt (Apache-2.0). See NOTICE.
//
// Bank-SMS transaction detection. Deliberately permissive in what it admits,
// and strict in what it promotes: a debit with a mismatched amount returns
// null (not this payment's confirmation), and any failure keyword records
// FAILED — never a silent SUCCESS. Pure: no storage, no ambient clock.

export type SmsStatus = "SUCCESS" | "FAILED";
export type SmsDirection = "DEBIT" | "CREDIT";

export interface ParsedSms {
  transactionId: string;
  amount: string;
  status: SmsStatus;
  bankName: string;
  /** Privacy-safe summary built from extracted fields — never the raw body. */
  excerpt: string;
  timestamp: number;
  upiId: string | null;
  direction: SmsDirection;
  counterparty: string | null;
  phoneNumber: string | null;
  /** Bank reference number (without the uniqueness suffix), if present. */
  reference: string | null;
}

const NAME_STOP_WORDS =
  "has|have|had|was|were|is|are|will|could|did|does|failed|declined|unsuccessful|not|due";
const NAME_TERMINATOR = `(?:\\s+(?:via|@|on|dated|for|from|to|UPI|Ref)\\b|\\s+(?:${NAME_STOP_WORDS})\\b|\\.|,|;|$)`;

const RECIPIENT_PATTERNS = [
  `(?:sent|paid|transferred)\\s+to\\s+([a-zA-Z][a-zA-Z\\s\\.]+?)${NAME_TERMINATOR}`,
  `to\\s+([a-zA-Z][a-zA-Z\\s\\.]+?)\\s+(?:via|@)`,
  `to\\s+(?:merchant|M/s\\.?|Mr\\.?|Mrs\\.?|Ms\\.?)\\s*([a-zA-Z][a-zA-Z\\s\\.]+?)(?:\\s+(?:via|@|on|for)\\b|\\s+(?:${NAME_STOP_WORDS})\\b|\\.|,|;|$)`,
  `Payment\\s+to\\s+([a-zA-Z][a-zA-Z\\s\\.]+?)\\s+(?:of|for)\\s+(?:Rs|INR|₹)`,
  `([a-zA-Z][a-zA-Z\\s\\.]+?)\\s*[-–]\\s*(?:Rs|INR|₹)`,
  `(?:Rs\\.?|INR|₹)\\s*[0-9,]+(?:\\.[0-9]{2})?\\s+(?:sent|paid|transferred)\\s+to\\s+([a-zA-Z][a-zA-Z\\s\\.]+?)${NAME_TERMINATOR}`,
  `\\bto\\s+([a-zA-Z][a-zA-Z\\s\\.]{2,40}?)${NAME_TERMINATOR}`,
  `to\\s+([a-zA-Z][a-zA-Z0-9\\s]+?)@`,
  `to\\s+(\\d{10})(?:\\s|\\.|,|;|$)`,
  `\\b([a-zA-Z][a-zA-Z\\s\\.]{2,40}?)\\s+credited\\b`,
].map((p) => new RegExp(p, "is"));

const SENDER_PATTERNS = [
  `(?:received|credited)\\s+from\\s+([a-zA-Z][a-zA-Z\\s\\.]+?)(?:\\s+(?:via|@|on|for)|\\.|,|;|$)`,
  `from\\s+([a-zA-Z][a-zA-Z\\s\\.]+?)\\s+(?:via|@)`,
  `(?:Rs\\.?|INR|₹)\\s*[0-9,]+(?:\\.[0-9]{2})?\\s+(?:received|credited)\\s+from\\s+([a-zA-Z][a-zA-Z\\s\\.]+?)${NAME_TERMINATOR}`,
  `\\bfrom\\s+([a-zA-Z][a-zA-Z\\s\\.]{2,40}?)${NAME_TERMINATOR}`,
  `from\\s+([a-zA-Z][a-zA-Z0-9\\s]+?)@`,
].map((p) => new RegExp(p, "is"));

// Order matters (first match wins), mirroring the Kotlin map's insertion order.
const BANK_KEYWORDS: [string, string][] = [
  ["HDFC", "HDFC Bank"],
  ["ICICI", "ICICI Bank"],
  ["SBI", "State Bank of India"],
  ["AXIS", "Axis Bank"],
  ["KOTAK", "Kotak Bank"],
  ["PNB", "Punjab National Bank"],
  ["BOB", "Bank of Baroda"],
  ["IDFC", "IDFC First Bank"],
  ["YES", "Yes Bank"],
  ["PAYTM", "Paytm Payments Bank"],
  ["UNION", "Union Bank"],
  ["CANARA", "Canara Bank"],
  ["IndusInd", "IndusInd Bank"],
  ["Federal", "Federal Bank"],
];

// Everyday-English keywords must appear as the full bank phrase in the body.
const AMBIGUOUS_BODY_PHRASES: Record<string, RegExp> = {
  YES: /\bYES\s+BANK\b/,
  BOB: /\bBANK\s+OF\s+BARODA\b|\bBOB\s+BANK\b/,
};

const SUCCESS_INDICATORS = [
  "successful", "successfully", "completed", "credited", "debited", "transferred",
  "sent to", "received from", "payment of", "paid to", "txn successful",
];

const FAILURE_INDICATORS = [
  "failed", "failure", "declined", "rejected", "unsuccessful", "not successful",
  "could not be processed", "cannot be processed", "not processed", "not completed",
  "insufficient", "reversed", "not debited", "txn expired", "timed out",
];

const DEBIT_INDICATORS = ["debited", "sent to", "paid to", "withdrawn", "spent", "transferred to"];

const TRANSACTION_VERBS = [
  "debited", "credited", "sent", "paid", "transferred", "withdrawn", "spent", "received", "deducted",
];

const AMOUNT_PATTERNS = [
  "(?:Rs\\.?|INR|₹)\\s*([0-9,]+(?:\\.[0-9]{1,2})?)",
  "amount\\s*(?:of)?\\s*(?:Rs\\.?|INR|₹)?\\s*([0-9,]+(?:\\.[0-9]{1,2})?)",
  "([0-9,]+(?:\\.[0-9]{1,2})?)\\s*(?:Rs\\.?|INR|₹)",
];

const BALANCE_CONTEXT = /(?:avl|available|avlbl|a\/c|account)?\s*bal(?:ance)?\s*[:.]?\s*$/i;
const BALANCE_LOOKBEHIND_CHARS = 24;

export interface ParseOptions {
  /** The amount we're waiting on. A debit for any other amount returns null. */
  expectedAmount?: string | null;
  clock?: () => number;
  randomSuffix?: () => number;
}

export function parseBankSms(sender: string, body: string, opts: ParseOptions = {}): ParsedSms | null {
  const clock = opts.clock ?? Date.now;
  const randomSuffix = opts.randomSuffix ?? (() => 1000 + Math.floor(Math.random() * 9000));

  const bankName = detectBank(sender, body);
  if (!bankName) return null;
  if (!isTransactionMessage(body)) return null;
  const amount = extractAmount(body);
  if (!amount) return null;

  const reference = extractReference(body);
  const transactionId = reference ? `${reference}_${clock()}` : `TXN${clock()}${randomSuffix()}`;
  const upiId = extractUpiId(body);
  const direction = detectDirection(body);
  const { name, phone } = extractCounterparty(body, direction);

  if (direction !== "CREDIT") {
    if (!describesTransaction(body)) return null;
    if (opts.expectedAmount && !isAmountMatching(amount, opts.expectedAmount)) return null;
  }

  const status: SmsStatus = detectsFailure(body) ? "FAILED" : "SUCCESS";

  return {
    transactionId,
    amount,
    status,
    bankName,
    excerpt: buildExcerpt(amount, direction, bankName, status),
    timestamp: clock(),
    upiId,
    direction,
    counterparty: name,
    phoneNumber: phone,
    reference,
  };
}

export function describesTransaction(body: string): boolean {
  const lower = body.toLowerCase();
  return TRANSACTION_VERBS.some((v) => lower.includes(v)) || detectsFailure(body);
}

export function detectsFailure(body: string): boolean {
  const lower = body.toLowerCase();
  return FAILURE_INDICATORS.some((f) => lower.includes(f));
}

/** Paise-exact: "100" == "100.00", but 500 != 500.75. */
export function isAmountMatching(extracted: string, expected: string): boolean {
  const a = Number(extracted.replace(/,/g, ""));
  const b = Number(expected.replace(/,/g, ""));
  if (!Number.isFinite(a) || !Number.isFinite(b)) return false;
  return Math.round(a * 100) === Math.round(b * 100);
}

const escapeRegex = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

export function detectBank(sender: string, body: string): string | null {
  const senderUpper = sender.toUpperCase();
  const bodyUpper = body.toUpperCase();

  for (const [kw, name] of BANK_KEYWORDS) {
    if (senderUpper.includes(kw.toUpperCase())) return name;
  }
  for (const [kw, name] of BANK_KEYWORDS) {
    const ambiguous = AMBIGUOUS_BODY_PHRASES[kw.toUpperCase()];
    const matched = ambiguous
      ? ambiguous.test(bodyUpper)
      : new RegExp(`\\b${escapeRegex(kw.toUpperCase())}\\b`).test(bodyUpper);
    if (matched) return name;
  }
  // Generic DLT-shaped sender (VK-HDFCBK, HDFCBK, 561616): a bank, we just don't know which.
  if (/^[A-Z]{2}-[A-Z0-9]{6}(-[A-Z])?$/.test(sender) || /^[A-Z]{6}$/.test(sender) || /^[0-9]{6}$/.test(sender)) {
    return "Bank";
  }
  return null;
}

export function isTransactionMessage(body: string): boolean {
  const lower = body.toLowerCase();
  if (SUCCESS_INDICATORS.some((s) => lower.includes(s))) return true;
  if (detectsFailure(body)) return true;
  return AMOUNT_PATTERNS.some((p) => new RegExp(p, "i").test(body));
}

export function extractAmount(body: string): string | null {
  const candidates: { start: number; amount: string }[] = [];
  for (const p of AMOUNT_PATTERNS) {
    for (const m of body.matchAll(new RegExp(p, "gi"))) {
      const amount = m[1]?.replace(/,/g, "");
      if (amount) candidates.push({ start: m.index ?? 0, amount });
    }
  }
  if (!candidates.length) return null;
  candidates.sort((a, b) => a.start - b.start); // stable, like Kotlin sortedBy
  const nonBalance = candidates.filter(
    ({ start }) => !BALANCE_CONTEXT.test(body.slice(0, start).slice(-BALANCE_LOOKBEHIND_CHARS)),
  );
  return (nonBalance.length ? nonBalance : candidates)[0].amount;
}

export function extractReference(body: string): string | null {
  const patterns = [
    /\b(?:ref|txn|transaction|id)\b\s*(?:no|number|id)?\s*[:.#]?\s*([A-Z0-9]+)/i,
    /([A-Z0-9]{10,})/i,
  ];
  for (const p of patterns) {
    const m = p.exec(body);
    if (m?.[1]) return m[1];
  }
  return null;
}

export function extractUpiId(body: string): string | null {
  const patterns = [
    /(?:UPI:|from|to|UPI ID:?)\s*([a-zA-Z0-9._-]+@[a-zA-Z0-9]+)/i,
    /(?:VPA:?)\s*([a-zA-Z0-9._-]+@[a-zA-Z0-9]+)/i,
  ];
  for (const p of patterns) {
    const m = p.exec(body);
    if (m?.[1]) return m[1];
  }
  return null;
}

/** A debit verb wins: many banks narrate both sides of one payment. */
export function detectDirection(body: string): SmsDirection {
  const lower = body.toLowerCase();
  if (DEBIT_INDICATORS.some((d) => lower.includes(d))) return "DEBIT";
  if (lower.includes("credited") || lower.includes("received") || lower.includes("added")) return "CREDIT";
  return "DEBIT";
}

export function extractCounterparty(body: string, direction: SmsDirection): { name: string | null; phone: string | null } {
  let name: string | null = null;
  let phone: string | null = null;
  for (const re of direction === "CREDIT" ? SENDER_PATTERNS : RECIPIENT_PATTERNS) {
    const extracted = re.exec(body)?.[1]?.trim();
    if (!extracted) continue;
    if (/^\d{10}$/.test(extracted)) {
      phone = extracted;
      continue;
    }
    const cleaned = cleanupName(extracted);
    if (cleaned) {
      name = cleaned;
      break;
    }
  }
  if (!name) name = nameFromUpi(body);
  return { name, phone };
}

const titleCase = (w: string) => (w ? w[0].toUpperCase() + w.slice(1).toLowerCase() : w);

export function cleanupName(raw: string): string | null {
  let cleaned = raw.trim().replace(/\s+/g, " ").replace(/[-–]$/, "").replace(/\.$/, "").trim();
  for (const prefix of ["M/s", "Mr", "Mrs", "Ms", "Dr", "merchant", "Merchant"]) {
    if (cleaned.toLowerCase().startsWith(prefix.toLowerCase())) {
      cleaned = cleaned.slice(prefix.length).trim();
      if (cleaned.startsWith(".")) cleaned = cleaned.slice(1).trim();
    }
  }
  if (cleaned.length < 2 || cleaned.length > 50) return null;
  if (!/[a-zA-Z]/.test(cleaned)) return null;
  return cleaned.split(" ").map(titleCase).join(" ");
}

/** "john.smith@ybl" → "John Smith" */
export function nameFromUpi(body: string): string | null {
  const prefix = /([a-zA-Z][a-zA-Z0-9._-]+)@[a-zA-Z0-9]+/i.exec(body)?.[1];
  if (!prefix) return null;
  return prefix.replace(/[._-]/g, " ").split(" ").filter(Boolean).map(titleCase).join(" ");
}

function buildExcerpt(amount: string, direction: SmsDirection, bank: string, status: SmsStatus): string {
  const verb = status === "FAILED" ? "payment failed" : direction === "CREDIT" ? "credited" : "debited";
  return `₹${amount} ${verb}${bank ? ` — ${bank}` : ""}`;
}
