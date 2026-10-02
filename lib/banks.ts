export const BANKS = [
  "State Bank of India",
  "HDFC Bank",
  "ICICI Bank",
  "Axis Bank",
  "Kotak Bank",
  "Punjab National Bank",
  "Bank of Baroda",
  "Canara Bank",
  "Union Bank",
  "Federal Bank",
  "IDFC First Bank",
  "IndusInd Bank",
  "Yes Bank",
  "South Indian Bank",
  "Kerala Gramin Bank",
  "Other",
];

/** DLT-style sender header for a bank, used by the demo SMS simulator. */
export function demoSender(bank: string) {
  const map: Record<string, string> = {
    "State Bank of India": "VK-SBIUPI",
    "HDFC Bank": "VK-HDFCBK",
    "ICICI Bank": "AD-ICICIB",
    "Axis Bank": "AX-AXISBK",
    "Kotak Bank": "KT-KOTAKB",
    "Federal Bank": "FB-FEDBNK",
    "Canara Bank": "CN-CANBNK",
  };
  return map[bank] ?? "VK-HDFCBK";
}

export function demoSmsBody(bank: string, amount: string, payee: string) {
  const ref = String(Math.floor(1e11 + Math.random() * 9e11));
  const b = bank && bank !== "Other" ? bank : "HDFC Bank";
  const alpha = payee.replace(/[^a-zA-Z ]/g, "").trim().toUpperCase();
  const digits = payee.replace(/\D/g, "");
  const name = alpha || (digits.length === 10 ? digits : "RECIPIENT");
  return `Rs.${Number(amount).toFixed(2)} sent to ${name} from ${b} A/c **4321 via UPI ref ${ref}`;
}
