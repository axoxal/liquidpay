// SPDX-License-Identifier: Apache-2.0
// Corpus adapted from Flowpay's SmsTransactionParserTest / QRCodeParserTest (Apache-2.0).
import { describe, expect, it } from "vitest";
import { parseBankSms, extractAmount, detectBank } from "./sms";
import { parseUpiQr, mobileFromVpa } from "./qr";
import { build123PayDial, ussdHref, normalizeMobile } from "./dial";
import { buildUpiUri } from "./intent";
import { routePayment, recommendedRail } from "./rails";
import { createSession, reduceSession } from "./session";

const bankCorpus: [string, string, string, string][] = [
  ["HDFC Bank", "VK-HDFCBK", "Rs.500.00 sent to KIRANA STORE from HDFC Bank A/c **1234 via UPI ref 512233440091 on 20-MAY-26", "500.00"],
  ["ICICI Bank", "AD-ICICIB", "INR 1,250.50 sent to Rahul Sharma from your ICICI A/c **5566 on 20MAY26 via UPI Ref 778899001122", "1250.50"],
  ["State Bank of India", "BP-SBIINB", "Rs 12,000 debited from your SBI A/c **7788 via UPI to 9876543210 on 20/05/26. Ref: 334455667788", "12000"],
  ["Axis Bank", "AX-AXISBK", "₹250.00 paid to merchant from Axis Bank A/c **9012. UPI Ref: 998877665544", "250.00"],
  ["Kotak Bank", "KT-KOTAKB", "100 Rs debited from Kotak A/c **3456. UPI Ref 112233445566", "100"],
  ["Punjab National Bank", "PN-PNBSMS", "Rs 3,499.00 transferred from PNB A/c **6789 to VPA merchant@okaxis. Ref 223344556677", "3499.00"],
  ["Bank of Baroda", "BB-BOBIBK", "INR 7500.25 sent to Priya Nair from Bank of Baroda A/c **2233 via UPI. Ref 445566778899", "7500.25"],
  ["IDFC First Bank", "ID-IDFCFB", "Rs 999 debited from IDFC A/c **4455 via UPI. Payment of Rs 999 to merchant@ybl. Ref 556677889900", "999"],
  ["Yes Bank", "YB-YESBNK", "Rs 42 transferred from Yes Bank A/c **6677 via UPI Ref 667788990011. Txn successful.", "42"],
  ["Paytm Payments Bank", "PT-PAYTMB", "Rs.300.00 paid to Rohit Kumar from Paytm Payments Bank A/c via UPI. Ref 778899001122", "300.00"],
  ["Union Bank", "UB-UNIONB", "Rs 15,000 debited from Union Bank A/c **8899 via UPI to 9988776655. Ref 889900112233", "15000"],
  ["Canara Bank", "CN-CANBNK", "INR 620.75 sent to Anita Desai from Canara Bank A/c **1122 via UPI. Ref 990011223344", "620.75"],
  ["IndusInd Bank", "IB-INDUSB", "Rs 88 debited from IndusInd Bank A/c **3344 via UPI. Payment of Rs 88 for Coffee. Ref 001122334455", "88"],
  ["Federal Bank", "FB-FEDBNK", "Rs 5,000.00 transferred from Federal Bank A/c **5566 to merchant@fbl via UPI. Ref 112233445566", "5000.00"],
  ["ICICI Bank", "AD-ICICIB", "ICICI Bank Acct XX556 debited for Rs 500.00 on 29-Jul-26; KIRANA STORE credited. UPI:512233440091", "500.00"],
  ["Union Bank", "VM-UNIONB", "Rs.2,340.00 debited from Union Bank A/c **8899 and credited to merchant@ubi. UPI Ref 445566778899", "2340.00"],
];

describe("bank SMS parser", () => {
  it.each(bankCorpus)("parses %s success", (bank, sender, body, amount) => {
    const r = parseBankSms(sender, body);
    expect(r).not.toBeNull();
    expect(r!.bankName).toBe(bank);
    expect(r!.amount).toBe(amount);
    expect(r!.status).toBe("SUCCESS");
    expect(r!.direction).toBe("DEBIT");
  });

  it.each([
    ["VK-HDFCBK", "Payment of Rs 500 failed. Ref 123456789012. -HDFC Bank"],
    ["AD-ICICIB", "Your UPI payment of Rs.75 could not be processed. Please retry. -ICICI Bank"],
    ["BP-SBIINB", "Rs 120 reversed to your SBI account **5678. Ref 998877"],
  ])("records failure for %s", (sender, body) => {
    expect(parseBankSms(sender, body)?.status).toBe("FAILED");
  });

  it("drops a debit for a different amount", () => {
    expect(parseBankSms("VK-HDFCBK", "Rs.100.00 sent to KIRANA STORE from HDFC Bank A/c **1234 via UPI ref 512233440091", { expectedAmount: "500" })).toBeNull();
  });

  it("matches paise-exact", () => {
    expect(parseBankSms("VK-HDFCBK", "Rs.500.00 sent to KIRANA STORE from HDFC Bank A/c **1234 via UPI ref 512233440091", { expectedAmount: "500" })?.status).toBe("SUCCESS");
  });

  it("ignores promos and Say-YES spam", () => {
    expect(parseBankSms("JD-BIGSALE", "Flash sale starts now! Check the app for today's deals.")).toBeNull();
    expect(parseBankSms("JD-PROMO4U", "Say YES to win Rs 5000! Reply YES to enter the lucky draw today.")).toBeNull();
  });

  it("skips the balance figure", () => {
    expect(parseBankSms("VK-SBIUPI", "Avl Bal Rs 34,210.00 in A/c X1234. Rs 2000 debited for UPI txn 512233440091 -SBI")?.amount).toBe("2000");
    expect(extractAmount("Rs 1,00,000.00 transferred to merchant")).toBe("100000.00");
  });

  it("reads credits and payee names", () => {
    const c = parseBankSms("AD-ICICIB", "INR 1,500.00 credited to ICICI A/c **5566 from Sanjay Mehta via UPI. Ref 665544332211");
    expect(c?.direction).toBe("CREDIT");
    expect(c?.amount).toBe("1500.00");
    expect(parseBankSms("VK-HDFCBK", "Rs.500.00 sent to KIRANA STORE from HDFC Bank A/c **1234 via UPI ref 512233440091")?.counterparty).toBe("Kirana Store");
    expect(parseBankSms("VK-HDFCBK", "Your payment of Rs.850.00 to BIG MERCHANT has failed. -HDFC Bank")?.counterparty).toBe("Big Merchant");
  });

  it("detects banks from DLT headers", () => {
    expect(detectBank("YB-YESBNK", "Rs 100 debited")).toBe("Yes Bank");
    expect(detectBank("561616", "Rs 100 debited")).toBe("Bank");
  });
});

describe("QR parser", () => {
  it("parses a full upi:// QR", () => {
    const r = parseUpiQr("upi://pay?pa=kirana.store@okaxis&pn=Kirana%20Store&am=120.50&tn=Milk&cu=INR");
    expect(r).toEqual({ ok: true, payee: { vpa: "kirana.store@okaxis", payeeName: "Kirana Store", amount: "120.50", note: "Milk", currency: "INR" } });
  });
  it("accepts a bare VPA and rejects junk", () => {
    expect(parseUpiQr("9876543210@ybl").ok).toBe(true);
    expect(parseUpiQr("https://example.com")).toEqual({ ok: false, reason: "NOT_A_UPI_QR" });
    expect(parseUpiQr("upi://pay?pn=x")).toEqual({ ok: false, reason: "NO_PAYEE_ADDRESS" });
    expect(parseUpiQr("upi://pay?pa=bad")).toEqual({ ok: false, reason: "INVALID_PAYEE_ADDRESS" });
    expect(parseUpiQr("upi://pay?pa=a.b@ybl&am=1.234")).toEqual({ ok: false, reason: "INVALID_AMOUNT" });
  });
  it("extracts a mobile from a phone-VPA", () => {
    expect(mobileFromVpa("9876543210@ybl")).toBe("9876543210");
    expect(mobileFromVpa("shop@okaxis")).toBeNull();
  });
});

describe("dial strings", () => {
  it("builds the exact 123Pay DTMF string", () => {
    expect(build123PayDial("+91 98765 43210", "500")).toEqual({ ok: true, href: "tel:08045163666,,1,9876543210,,500,,1" });
  });
  it("rejects decimals, caps and bad numbers", () => {
    expect(build123PayDial("9876543210", "10.50")).toEqual({ ok: false, reason: "AMOUNT_NOT_WHOLE_RUPEES" });
    expect(build123PayDial("9876543210", "5000")).toEqual({ ok: false, reason: "AMOUNT_ABOVE_CAP" });
    expect(build123PayDial("9876543210", "5000", { cap: 10000 }).ok).toBe(true);
    expect(build123PayDial("12345", "10")).toEqual({ ok: false, reason: "RECIPIENT_NUMBER" });
    expect(build123PayDial("9876543210", "0")).toEqual({ ok: false, reason: "AMOUNT_BELOW_MINIMUM" });
  });
  it("percent-encodes # in USSD", () => {
    expect(ussdHref("*99*1*3#")).toBe("tel:*99*1*3%23");
    expect(normalizeMobile("09876543210")).toBe("9876543210");
  });
  it("builds a upi:// intent", () => {
    expect(buildUpiUri({ vpa: "kirana@okaxis", name: "Kirana Store", amount: "50" })).toBe("upi://pay?pa=kirana%40okaxis&pn=Kirana%20Store&am=50.00&cu=INR");
    expect(buildUpiUri({ vpa: "nope" })).toBeNull();
  });
});

describe("rail routing", () => {
  const jio = [{ slot: 1 as const, carrier: "jio" as const }];
  const dual = [...jio, { slot: 2 as const, carrier: "airtel" as const }];

  it("Jio + phone QR offline → 123Pay", () => {
    const r = routePayment({ target: { kind: "vpa", vpa: "9876543210@ybl" }, amount: "200", sims: jio, online: false });
    expect(recommendedRail(r)?.id).toBe("ivr123");
    expect(r.find((o) => o.id === "ussd")?.blocker).toBe("JIO_NO_USSD");
  });
  it("Jio + merchant QR offline → nothing live, queue only", () => {
    const r = routePayment({ target: { kind: "vpa", vpa: "shop@okaxis" }, amount: "200", sims: jio, online: false });
    expect(recommendedRail(r)).toBeNull();
    expect(r.find((o) => o.id === "queue")?.available).toBe(true);
  });
  it("dual SIM Jio+Airtel merchant QR → USSD on slot 2", () => {
    const r = routePayment({ target: { kind: "vpa", vpa: "shop@okaxis" }, amount: "200", sims: dual, online: false });
    const pick = recommendedRail(r)!;
    expect(pick.id).toBe("ussd");
    expect(pick.simSlot).toBe(2);
    expect(pick.copyText).toBe("shop@okaxis");
  });
  it("online prefers the UPI app intent", () => {
    const r = routePayment({ target: { kind: "vpa", vpa: "shop@okaxis" }, amount: "200", sims: jio, online: true });
    expect(recommendedRail(r)?.id).toBe("online");
  });
});

describe("payment session", () => {
  const base = () => reduceSession(createSession({ id: "1", rail: "ivr123", amount: "500", payeeLabel: "K", payeeId: "9876543210" }, 0), { type: "DIAL", now: 0 });

  it("only a matching bank SMS marks success", () => {
    let s = reduceSession(base(), { type: "SMS", sender: "VK-HDFCBK", body: "Rs.100.00 sent to X from HDFC Bank via UPI ref 512233440091", now: 1 });
    expect(s.phase).toBe("dialing");
    expect(s.lastRejected).toBe("AMOUNT_MISMATCH");
    s = reduceSession(s, { type: "SMS", sender: "VK-HDFCBK", body: "Rs.500.00 sent to X from HDFC Bank via UPI ref 512233440091", now: 2 });
    expect(s.phase).toBe("success");
  });
  it("self-report is unverified, not success", () => {
    expect(reduceSession(base(), { type: "USER_CONFIRMED" }).phase).toBe("unverified");
  });
  it("short call cancels, deadline times out", () => {
    expect(reduceSession(base(), { type: "CALL_ENDED", now: 1000, durationMs: 2000 }).phase).toBe("cancelled");
    expect(reduceSession(base(), { type: "TICK", now: 10 * 60 * 1000 }).phase).toBe("timeout");
  });
});

import { detectCarrier } from "./carrier";
describe("carrier detection", () => {
  it("maps Android carrier names", () => {
    expect(detectCarrier("Jio 4G")).toBe("jio");
    expect(detectCarrier("JIO")).toBe("jio");
    expect(detectCarrier("airtel")).toBe("airtel");
    expect(detectCarrier("Vi India")).toBe("vi");
    expect(detectCarrier("Vodafone IN")).toBe("vi");
    expect(detectCarrier("BSNL MOBILE")).toBe("bsnl");
    expect(detectCarrier("Unknown", "405", "857")).toBe("jio");
    expect(detectCarrier("Unknown", "404", "10")).toBe("other");
  });
});

describe("123Pay pacing", () => {
  it("lengthens gaps between DTMF steps", () => {
    expect(build123PayDial("9876543210", "50", { pauses: 3 })).toEqual({ ok: true, href: "tel:08045163666,,,1,9876543210,,,50,,,1" });
    expect(build123PayDial("9876543210", "50", { pauses: 99 }).ok && build123PayDial("9876543210", "50", { pauses: 99 })).toEqual({ ok: true, href: "tel:08045163666,,,,,,1,9876543210,,,,,,50,,,,,,1" });
  });
});
