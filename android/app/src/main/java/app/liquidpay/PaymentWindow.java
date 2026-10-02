// SPDX-License-Identifier: Apache-2.0
// Operation window + pending-SMS queue, modelled on Flowpay's TransactionDetector.
package app.liquidpay;

import android.content.Context;
import android.content.SharedPreferences;

import org.json.JSONArray;
import org.json.JSONObject;

/**
 * Bank SMS are only looked at while a payment is in flight. The window opens
 * when we dial and closes after the verification deadline (plus grace), so the
 * app never reads or keeps unrelated messages. Matching SMS are queued in
 * app-private storage until the web layer takes them, which survives the
 * WebView being paused or the process being restarted mid-payment.
 */
final class PaymentWindow {
    private static final String PREFS = "liquidpay_payment_window";
    private static final String KEY_UNTIL = "until";
    private static final String KEY_QUEUE = "queue";
    private static final int MAX_QUEUE = 8;
    /** 10-minute verification deadline + 30 s grace, as in Flowpay. */
    static final long WINDOW_MS = 10 * 60 * 1000L + 30 * 1000L;

    private PaymentWindow() {}

    private static SharedPreferences prefs(Context c) {
        return c.getApplicationContext().getSharedPreferences(PREFS, Context.MODE_PRIVATE);
    }

    static void open(Context c) {
        prefs(c).edit().putLong(KEY_UNTIL, System.currentTimeMillis() + WINDOW_MS).apply();
    }

    static void close(Context c) {
        prefs(c).edit().putLong(KEY_UNTIL, 0L).remove(KEY_QUEUE).apply();
    }

    static boolean isOpen(Context c) {
        return System.currentTimeMillis() < prefs(c).getLong(KEY_UNTIL, 0L);
    }

    static synchronized void enqueue(Context c, String sender, String body, long at) {
        try {
            JSONArray q = new JSONArray(prefs(c).getString(KEY_QUEUE, "[]"));
            JSONObject o = new JSONObject();
            o.put("sender", sender);
            o.put("body", body);
            o.put("at", at);
            q.put(o);
            while (q.length() > MAX_QUEUE) q.remove(0);
            prefs(c).edit().putString(KEY_QUEUE, q.toString()).apply();
        } catch (Exception ignored) {
            // A malformed queue is dropped rather than crashing the receiver.
            prefs(c).edit().remove(KEY_QUEUE).apply();
        }
    }

    static synchronized JSONArray take(Context c) {
        JSONArray q;
        try {
            q = new JSONArray(prefs(c).getString(KEY_QUEUE, "[]"));
        } catch (Exception e) {
            q = new JSONArray();
        }
        prefs(c).edit().remove(KEY_QUEUE).apply();
        return q;
    }
}
