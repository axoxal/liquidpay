// SPDX-License-Identifier: Apache-2.0
// Portions derived from Flowpay (https://github.com/Flowpayup/Payments-Without-Internet),
// Copyright 2026 Flowpay, Apache-2.0. See NOTICE.

/** NPCI's published UPI 123Pay IVR number (same default Flowpay ships). */
export const UPI123PAY_SERVICE_NUMBER = "08045163666";

/**
 * RBI raised the 123Pay ceiling to ₹10,000 (Oct 2024), but Flowpay observed the
 * IVR rejecting amounts ≥ ₹5,000 mid-call on real devices. We default to the
 * field-proven cap and let the user raise it in Settings.
 */
export const UPI123PAY_DEFAULT_CAP = 4999;
export const UPI123PAY_RBI_CAP = 10000;

export const MIN_AMOUNT = 1;
export const MAX_AMOUNT = 100000;

/** USSD *99# shortcodes. QR/VPA pay uses the scan-to-pay branch Flowpay dials. */
export const USSD_MAIN = "*99#";
export const USSD_PAY_VPA = "*99*1*3#";

/** Indian mobile number (10 digits, no leading 0). */
export const PHONE_REGEX = /^[1-9][0-9]{9}$/;

/** NPCI VPA shape: local part, @, alphanumeric PSP handle starting with a letter. */
export const VPA_REGEX = /^[a-zA-Z0-9.\-_]{2,256}@[a-zA-Z][a-zA-Z0-9]{1,64}$/;

/** How long a payment waits for its bank SMS before being discarded. */
export const VERIFICATION_DEADLINE_MS = 10 * 60 * 1000;
