// SPDX-License-Identifier: Apache-2.0
// Port of Flowpay's SimpleSMSReceiver: RECEIVE_SMS only, never READ_SMS (the inbox is never read).
package app.liquidpay;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.provider.Telephony;
import android.telephony.SmsMessage;

import java.util.LinkedHashMap;
import java.util.Map;

public class SmsReceiver extends BroadcastReceiver {
    @Override
    public void onReceive(Context context, Intent intent) {
        if (!Telephony.Sms.Intents.SMS_RECEIVED_ACTION.equals(intent.getAction())) return;
        // Outside a payment window we ignore every message — nothing is read or stored.
        if (!PaymentWindow.isOpen(context)) return;

        SmsMessage[] parts = Telephony.Sms.Intents.getMessagesFromIntent(intent);
        if (parts == null || parts.length == 0) return;

        // Multipart SMS arrive as several PDUs; join them per sender.
        Map<String, StringBuilder> bySender = new LinkedHashMap<>();
        long at = System.currentTimeMillis();
        for (SmsMessage m : parts) {
            if (m == null) continue;
            String sender = m.getDisplayOriginatingAddress();
            if (sender == null) sender = "";
            StringBuilder sb = bySender.get(sender);
            if (sb == null) {
                sb = new StringBuilder();
                bySender.put(sender, sb);
            }
            sb.append(m.getDisplayMessageBody() == null ? "" : m.getDisplayMessageBody());
        }
        for (Map.Entry<String, StringBuilder> e : bySender.entrySet()) {
            PaymentWindow.enqueue(context, e.getKey(), e.getValue().toString(), at);
        }
        LiquidPayPlugin.onSmsQueued(context);
    }
}
