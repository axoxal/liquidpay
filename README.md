# LiquidPay

UPI payments without internet: an open-source, liquid-glass payments app for India.

LiquidPay puts a modern UI on the two offline UPI rails that already exist on every Indian SIM:

- **UPI 123Pay (IVR call):** works on every network, including Jio. LiquidPay builds the DTMF dial string, so the call enters the menu, recipient and amount for you. You type your UPI PIN into your bank's call; the app never sees it.
- **`*99#` USSD:** for Airtel, Vi and BSNL SIMs. Jio never carried USSD.
- **Online UPI intent (`upi://pay`):** opens GPay, PhonePe or BHIM when you do have data.

A payment is marked **successful only when your bank's SMS confirms the exact amount.** The app never trusts call state or a button tap. A self-reported payment is stored as *Unverified*.

## Rail routing

| You're paying | Your SIM | Route |
|---|---|---|
| A mobile number | any (incl. Jio) | 123Pay call |
| A QR with a phone UPI ID (`98…@ybl`) | Jio | 123Pay call to that number |
| A merchant QR (`shop@okaxis`) | Airtel / Vi / BSNL, or 2nd SIM | `*99#` on that SIM, VPA copied for you |
| A merchant QR | Jio only, offline | Saved to "Pay later", reminded when online |
| Anything | online | UPI app intent |

The routing logic is in `lib/upi/rails.ts` and is unit-tested.

## What's in the app

- Offline pay: contact, QR scan (camera / photo / paste), 123Pay, `*99#`, pay-later queue
- Receive: your own UPI QR, download as PNG
- Khata: customer credit ledger with SMS reminders
- Insights, Business mode (daily collection, voice alerts), Pro plans *(demo, no billing)*
- Crypto Wallet: **front-end preview only.** It uses static demo data, generates no keys and makes no network calls.
- English, हिन्दी, മലയാളം · Day/Night themes · Lite mode for low-end phones

## Run it

```bash
npm install
npm run dev -- -H 0.0.0.0     # http://localhost:3000
npm test                      # UPI engine unit tests
```

To place a **real** 123Pay call, open `http://<your-laptop-ip>:3000` on an Android phone on the same Wi-Fi. On a desktop the session screen offers a *Simulate bank SMS* button that runs the real parser.

Notes:
- Browsers can't read SMS. Paste the bank SMS into the session screen, or use the native Android build (planned: a Capacitor plugin implementing `window.LiquidPayNative` in `lib/native.ts`), which reads it automatically.
- iOS blocks `*99#` from apps and the web. On iPhone only the 123Pay call rail is offered.
- The 123Pay cap defaults to ₹4,999. Flowpay observed the IVR rejecting ₹5,000+ on real devices even though RBI allows ₹10,000. You can change it in Settings.

## Status / roadmap

1. ✅ Web front end and UPI engine (this repo)
2. ⏳ Capacitor Android shell + native call/SMS plugin (port of Flowpay's `CallManager` and `SimpleSMSReceiver`)
3. ⏳ Supabase (optional encrypted backup, Pro, waitlist) + Vercel
4. ⏳ Self-custody crypto wallet

## Credits & legal

The UPI engine is ported from [Flowpay — Payments Without Internet](https://github.com/Flowpayup/Payments-Without-Internet) (Apache-2.0). See `NOTICE`.

LiquidPay is not a bank or payment service, and is not affiliated with NPCI, any bank or any telecom operator. Transactions are between you and your bank. Telecom charges may apply to calls and USSD. Provided as-is under the [Apache License 2.0](LICENSE).
