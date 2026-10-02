// SPDX-License-Identifier: Apache-2.0
// Native payment bridge for LiquidPay. Ports the Android-only pieces of Flowpay
// (CallManager, CallStateCoordinator, SimpleSMSReceiver, CallOverlayService) so
// an offline 123Pay payment runs from inside the app:
//   direct dial on the chosen SIM → muted IVR call under a LiquidPay overlay →
//   call-state events → bank SMS delivered to the web layer → auto hang-up.
// The UPI PIN is never seen: it is typed into the bank's own call.
package app.liquidpay;

import android.Manifest;
import android.annotation.SuppressLint;
import android.content.ActivityNotFoundException;
import android.content.Context;
import android.content.Intent;
import android.database.Cursor;
import android.media.AudioManager;
import android.net.Uri;
import android.os.Build;
import android.os.Handler;
import android.os.Looper;
import android.provider.ContactsContract;
import android.provider.Settings;
import android.telecom.PhoneAccountHandle;
import android.telecom.TelecomManager;
import android.telephony.PhoneStateListener;
import android.telephony.SubscriptionInfo;
import android.telephony.SubscriptionManager;
import android.telephony.TelephonyCallback;
import android.telephony.TelephonyManager;

import androidx.activity.result.ActivityResult;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.PermissionState;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.ActivityCallback;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;

import org.json.JSONArray;
import org.json.JSONObject;

import java.util.List;
import java.util.concurrent.Executor;

@CapacitorPlugin(
    name = "LiquidPay",
    permissions = {
        @Permission(alias = "phone", strings = { Manifest.permission.CALL_PHONE, Manifest.permission.READ_PHONE_STATE }),
        @Permission(alias = "sms", strings = { Manifest.permission.RECEIVE_SMS }),
        @Permission(alias = "answer", strings = { Manifest.permission.ANSWER_PHONE_CALLS }),
        @Permission(alias = "camera", strings = { Manifest.permission.CAMERA }),
    }
)
public class LiquidPayPlugin extends Plugin {

    private static LiquidPayPlugin instance;
    private final Handler main = new Handler(Looper.getMainLooper());

    // --- call tracking for the payment in flight ---
    private boolean tracking = false;
    private String rail = "ivr123";
    private boolean muteRequested = false;
    private boolean muted = false;
    private long offhookAt = 0L;
    private int lastState = TelephonyManager.CALL_STATE_IDLE;
    private boolean outgoingEnded = false;
    private JSObject labels = new JSObject();
    private int savedVoiceVolume = -1;

    private PhoneStateListener legacyListener;
    private Object telephonyCallback; // TelephonyCallback on API 31+

    @Override
    public void load() {
        instance = this;
    }

    @Override
    protected void handleOnDestroy() {
        stopTracking();
        if (instance == this) instance = null;
    }

    // ------------------------------------------------------------------ SIMs

    @SuppressLint("MissingPermission")
    @PluginMethod
    public void getSims(PluginCall call) {
        JSArray out = new JSArray();
        if (getPermissionState("phone") == PermissionState.GRANTED) {
            try {
                SubscriptionManager sm = (SubscriptionManager) getContext().getSystemService(Context.TELEPHONY_SUBSCRIPTION_SERVICE);
                List<SubscriptionInfo> subs = sm == null ? null : sm.getActiveSubscriptionInfoList();
                if (subs != null) {
                    for (SubscriptionInfo s : subs) {
                        JSObject o = new JSObject();
                        o.put("slot", s.getSimSlotIndex() + 1);
                        o.put("carrierName", String.valueOf(s.getCarrierName()));
                        o.put("displayName", String.valueOf(s.getDisplayName()));
                        o.put("subscriptionId", s.getSubscriptionId());
                        if (Build.VERSION.SDK_INT >= 29) {
                            o.put("mcc", s.getMccString());
                            o.put("mnc", s.getMncString());
                        }
                        out.put(o);
                    }
                }
            } catch (SecurityException ignored) {
                // falls through with an empty list
            }
        }
        JSObject ret = new JSObject();
        ret.put("sims", out);
        call.resolve(ret);
    }

    @SuppressLint("MissingPermission")
    private PhoneAccountHandle handleForSlot(Integer slot) {
        if (slot == null) return null;
        try {
            SubscriptionManager sm = (SubscriptionManager) getContext().getSystemService(Context.TELEPHONY_SUBSCRIPTION_SERVICE);
            TelecomManager tm = (TelecomManager) getContext().getSystemService(Context.TELECOM_SERVICE);
            TelephonyManager tel = (TelephonyManager) getContext().getSystemService(Context.TELEPHONY_SERVICE);
            SubscriptionInfo info = sm.getActiveSubscriptionInfoForSimSlotIndex(slot - 1);
            if (info == null) return null;
            List<PhoneAccountHandle> handles = tm.getCallCapablePhoneAccounts();
            for (PhoneAccountHandle h : handles) {
                if (Build.VERSION.SDK_INT >= 30) {
                    if (tel.getSubscriptionId(h) == info.getSubscriptionId()) return h;
                } else {
                    String id = h.getId();
                    if (id == null) continue;
                    if (id.equals(String.valueOf(info.getSubscriptionId()))) return h;
                    String icc = info.getIccId();
                    if (icc != null && !icc.isEmpty() && id.startsWith(icc)) return h;
                }
            }
        } catch (Exception ignored) {
            // Unknown mapping: the system default SIM is used.
        }
        return null;
    }

    // --------------------------------------------------------------- overlay

    @PluginMethod
    public void getOverlayPermission(PluginCall call) {
        JSObject ret = new JSObject();
        ret.put("granted", Settings.canDrawOverlays(getContext()));
        call.resolve(ret);
    }

    @PluginMethod
    public void openOverlaySettings(PluginCall call) {
        Intent i = new Intent(Settings.ACTION_MANAGE_OVERLAY_PERMISSION, Uri.parse("package:" + getContext().getPackageName()));
        i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        getContext().startActivity(i);
        call.resolve();
    }

    @PluginMethod
    public void openAppSettings(PluginCall call) {
        Intent i = new Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS, Uri.parse("package:" + getContext().getPackageName()));
        i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        getContext().startActivity(i);
        call.resolve();
    }

    @PluginMethod
    public void hideOverlay(PluginCall call) {
        CallOverlayService.hide(getContext());
        call.resolve();
    }

    @PluginMethod
    public void updateOverlay(PluginCall call) {
        CallOverlayService.update(getContext(), call.getString("status", ""), call.getBoolean("banner", true));
        call.resolve();
    }

    private Intent overlayExtras(String status, boolean banner) {
        Intent i = new Intent();
        String[] keys = { "title", "payee", "amount", "note", "endCall", "openApp", "answerCall", "statusAnswered" };
        for (String k : keys) {
            String v = labels.getString(k);
            if (v != null) i.putExtra(k, v);
        }
        i.putExtra("status", status);
        i.putExtra("banner", banner);
        return i;
    }

    // ------------------------------------------------------------------ dial

    @PluginMethod
    public void dial(PluginCall call) {
        String href = call.getString("href");
        if (href == null || !href.startsWith("tel:")) {
            call.reject("Invalid dial URI", "INVALID_HREF");
            return;
        }
        if (getPermissionState("phone") != PermissionState.GRANTED) {
            call.reject("Phone permission not granted", "NO_PHONE_PERMISSION");
            return;
        }
        Integer slot = call.getInt("simSlot");
        rail = call.getString("rail", "ivr123");
        // Listen mode: no mute, no cover screen, so the user can hear the 123Pay
        // menu (first-time registration, or to see where the digits go wrong).
        boolean listen = call.getBoolean("listen", false);
        muteRequested = !listen && call.getBoolean("mute", true) && "ivr123".equals(rail);
        JSObject l = call.getObject("labels");
        labels = l == null ? new JSObject() : l;

        Intent intent = new Intent(Intent.ACTION_CALL, Uri.parse(href));
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        PhoneAccountHandle handle = handleForSlot(slot);
        if (handle != null) intent.putExtra(TelecomManager.EXTRA_PHONE_ACCOUNT_HANDLE, handle);
        if (slot != null) {
            // OEM dialers that ignore the PhoneAccountHandle read one of these.
            intent.putExtra("com.android.phone.extra.slot", slot - 1);
            intent.putExtra("simSlot", slot - 1);
            intent.putExtra("slot", slot - 1);
        }

        PaymentWindow.open(getContext());
        startTracking();
        try {
            getContext().startActivity(intent);
        } catch (SecurityException e) {
            stopTracking();
            call.reject("Call not permitted", "NO_PHONE_PERMISSION");
            return;
        } catch (ActivityNotFoundException e) {
            stopTracking();
            call.reject("No dialer", "NO_DIALER");
            return;
        }
        // USSD menus are a system dialog the user must see, so no overlay for *99#.
        if ("ivr123".equals(rail) && !listen) {
            main.postDelayed(() -> CallOverlayService.show(getContext(), overlayExtras(labels.getString("statusCalling", ""), false)), 400);
        }
        JSObject ret = new JSObject();
        ret.put("simSelected", handle != null);
        ret.put("overlay", Settings.canDrawOverlays(getContext()));
        call.resolve(ret);
    }

    @PluginMethod
    public void answerCall(PluginCall call) {
        JSObject ret = new JSObject();
        ret.put("answered", answerCallStatic(getContext()));
        call.resolve(ret);
    }

    /** Picks up the ringing call (the bank's PIN callback). Needs ANSWER_PHONE_CALLS. */
    @SuppressLint("MissingPermission")
    static boolean answerCallStatic(Context c) {
        try {
            if (Build.VERSION.SDK_INT < 26) return false;
            if (c.checkSelfPermission(Manifest.permission.ANSWER_PHONE_CALLS) != android.content.pm.PackageManager.PERMISSION_GRANTED) return false;
            TelecomManager tm = (TelecomManager) c.getSystemService(Context.TELECOM_SERVICE);
            if (tm == null) return false;
            tm.acceptRingingCall();
            return true;
        } catch (Exception e) {
            return false;
        }
    }

    @PluginMethod
    public void endCall(PluginCall call) {
        JSObject ret = new JSObject();
        ret.put("ended", endCallStatic(getContext()));
        call.resolve(ret);
    }

    /** Ends the live call via TelecomManager (needs ANSWER_PHONE_CALLS); best-effort, as in Flowpay. */
    @SuppressLint("MissingPermission")
    static boolean endCallStatic(Context c) {
        try {
            if (Build.VERSION.SDK_INT < 28) return false;
            if (c.checkSelfPermission(Manifest.permission.ANSWER_PHONE_CALLS) != android.content.pm.PackageManager.PERMISSION_GRANTED) return false;
            TelecomManager tm = (TelecomManager) c.getSystemService(Context.TELECOM_SERVICE);
            //noinspection deprecation
            return tm != null && tm.endCall();
        } catch (Exception e) {
            return false;
        }
    }

    /** Closes the SMS window, hides the overlay and stops call tracking. */
    @PluginMethod
    public void finishPayment(PluginCall call) {
        PaymentWindow.close(getContext());
        CallOverlayService.hide(getContext());
        stopTracking();
        call.resolve();
    }

    // ------------------------------------------------------------ call state

    private void startTracking() {
        stopTracking();
        tracking = true;
        offhookAt = 0L;
        outgoingEnded = false;
        lastState = TelephonyManager.CALL_STATE_IDLE;
        TelephonyManager tel = (TelephonyManager) getContext().getSystemService(Context.TELEPHONY_SERVICE);
        if (tel == null) return;
        try {
            if (Build.VERSION.SDK_INT >= 31) {
                Executor ex = getContext().getMainExecutor();
                TelephonyCallback cb = new CallStateCallback();
                tel.registerTelephonyCallback(ex, cb);
                telephonyCallback = cb;
            } else {
                legacyListener = new PhoneStateListener() {
                    @Override
                    public void onCallStateChanged(int state, String phoneNumber) {
                        onState(state);
                    }
                };
                //noinspection deprecation
                tel.listen(legacyListener, PhoneStateListener.LISTEN_CALL_STATE);
            }
        } catch (SecurityException ignored) {
            tracking = false;
        }
    }

    private class CallStateCallback extends TelephonyCallback implements TelephonyCallback.CallStateListener {
        @Override
        public void onCallStateChanged(int state) {
            onState(state);
        }
    }

    private void stopTracking() {
        tracking = false;
        restoreAudio();
        TelephonyManager tel = (TelephonyManager) getContext().getSystemService(Context.TELEPHONY_SERVICE);
        if (tel == null) return;
        try {
            if (Build.VERSION.SDK_INT >= 31 && telephonyCallback != null) {
                tel.unregisterTelephonyCallback((TelephonyCallback) telephonyCallback);
            } else if (legacyListener != null) {
                //noinspection deprecation
                tel.listen(legacyListener, PhoneStateListener.LISTEN_NONE);
            }
        } catch (Exception ignored) {
        }
        telephonyCallback = null;
        legacyListener = null;
    }

    private void onState(int state) {
        if (!tracking) return;
        long now = System.currentTimeMillis();
        JSObject ev = new JSObject();
        if (state == TelephonyManager.CALL_STATE_OFFHOOK) {
            if (offhookAt == 0L) offhookAt = now;
            if (!outgoingEnded && muteRequested) muteAudio();
            ev.put("state", "offhook");
        } else if (state == TelephonyManager.CALL_STATE_RINGING) {
            ev.put("state", "ringing");
            // Usually the bank calling back for the UPI PIN.
            if (outgoingEnded && "ivr123".equals(rail)) {
                CallOverlayService.update(getContext(), labels.getString("statusRinging", ""), true, true);
            }
        } else {
            ev.put("state", "idle");
            if (lastState != TelephonyManager.CALL_STATE_IDLE) {
                long dur = offhookAt == 0L ? 0L : now - offhookAt;
                ev.put("durationMs", dur);
                if (!outgoingEnded) {
                    outgoingEnded = true;
                    restoreAudio();
                    ev.put("first", true);
                    if ("ivr123".equals(rail)) {
                        CallOverlayService.update(getContext(), labels.getString("statusWaiting", ""), true);
                    }
                    bringAppToFront(getContext());
                }
                offhookAt = 0L;
            }
        }
        lastState = state;
        notifyListeners("callState", ev);
    }

    // ------------------------------------------------------------------ audio

    private void muteAudio() {
        if (muted) return;
        try {
            AudioManager am = (AudioManager) getContext().getSystemService(Context.AUDIO_SERVICE);
            savedVoiceVolume = am.getStreamVolume(AudioManager.STREAM_VOICE_CALL);
            am.setMicrophoneMute(true);
            int min = Build.VERSION.SDK_INT >= 28 ? am.getStreamMinVolume(AudioManager.STREAM_VOICE_CALL) : 0;
            // Only the voice-call stream: ring/alarm/notification volumes are never touched.
            am.setStreamVolume(AudioManager.STREAM_VOICE_CALL, min, 0);
            muted = true;
        } catch (Exception ignored) {
            // Best-effort: some OEMs refuse; the payment still works, just audibly.
        }
    }

    private void restoreAudio() {
        if (!muted) return;
        try {
            AudioManager am = (AudioManager) getContext().getSystemService(Context.AUDIO_SERVICE);
            am.setMicrophoneMute(false);
            if (savedVoiceVolume >= 0) am.setStreamVolume(AudioManager.STREAM_VOICE_CALL, savedVoiceVolume, 0);
        } catch (Exception ignored) {
        }
        muted = false;
    }

    // -------------------------------------------------------------------- SMS

    @PluginMethod
    public void takePendingSms(PluginCall call) {
        JSONArray q = PaymentWindow.take(getContext());
        JSArray out = new JSArray();
        for (int i = 0; i < q.length(); i++) {
            JSONObject o = q.optJSONObject(i);
            if (o != null) out.put(o);
        }
        JSObject ret = new JSObject();
        ret.put("messages", out);
        call.resolve(ret);
    }

    static void onSmsQueued(Context c) {
        LiquidPayPlugin p = instance;
        if (p != null) p.main.post(() -> p.notifyListeners("sms", new JSObject(), true));
        bringAppToFront(c);
    }

    static void emitOverlayAction(String action) {
        LiquidPayPlugin p = instance;
        if (p == null) return;
        JSObject o = new JSObject();
        o.put("action", action);
        p.main.post(() -> p.notifyListeners("overlayAction", o));
    }

    static void bringAppToFront(Context c) {
        try {
            Intent i = new Intent(c, MainActivity.class);
            i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_REORDER_TO_FRONT | Intent.FLAG_ACTIVITY_SINGLE_TOP);
            c.startActivity(i);
        } catch (Exception ignored) {
            // Background activity start blocked: the overlay "Open LiquidPay" button still works.
        }
    }

    // ------------------------------------------------------------- contacts

    @PluginMethod
    public void pickContact(PluginCall call) {
        Intent i = new Intent(Intent.ACTION_PICK, ContactsContract.CommonDataKinds.Phone.CONTENT_URI);
        startActivityForResult(call, i, "onContactPicked");
    }

    @ActivityCallback
    private void onContactPicked(PluginCall call, ActivityResult result) {
        if (call == null) return;
        Intent data = result.getData();
        if (result.getResultCode() != android.app.Activity.RESULT_OK || data == null || data.getData() == null) {
            call.reject("cancelled", "CANCELLED");
            return;
        }
        String[] cols = { ContactsContract.CommonDataKinds.Phone.NUMBER, ContactsContract.CommonDataKinds.Phone.DISPLAY_NAME };
        try (Cursor c = getContext().getContentResolver().query(data.getData(), cols, null, null, null)) {
            if (c != null && c.moveToFirst()) {
                JSObject ret = new JSObject();
                ret.put("phone", c.getString(0));
                ret.put("name", c.getString(1));
                call.resolve(ret);
                return;
            }
        } catch (Exception ignored) {
        }
        call.reject("No number", "NO_NUMBER");
    }

    // -------------------------------------------------------------- upi://

    @PluginMethod
    public void openUri(PluginCall call) {
        String href = call.getString("href");
        if (href == null || !href.startsWith("upi:")) {
            call.reject("Only upi: links", "INVALID_HREF");
            return;
        }
        try {
            Intent i = new Intent(Intent.ACTION_VIEW, Uri.parse(href));
            i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            getContext().startActivity(Intent.createChooser(i, labels.getString("chooser", "Pay with")).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK));
            call.resolve();
        } catch (ActivityNotFoundException e) {
            call.reject("No UPI app installed", "NO_UPI_APP");
        }
    }
}
