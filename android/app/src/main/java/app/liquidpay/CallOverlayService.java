// SPDX-License-Identifier: Apache-2.0
// LiquidPay call overlay, modelled on Flowpay's CallOverlayService: a window over
// the system call screen so the user sees LiquidPay instead of the dialer while
// the IVR digits are sent. Views are built in code (no Compose) for the same
// reason Flowpay gives: an overlay window has no lifecycle owner.
package app.liquidpay;

import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.graphics.Color;
import android.graphics.PixelFormat;
import android.graphics.Typeface;
import android.graphics.drawable.GradientDrawable;
import android.os.Build;
import android.os.Handler;
import android.os.IBinder;
import android.os.Looper;
import android.provider.Settings;
import android.util.TypedValue;
import android.view.Gravity;
import android.view.View;
import android.view.ViewGroup;
import android.view.WindowManager;
import android.widget.Button;
import android.widget.FrameLayout;
import android.widget.LinearLayout;
import android.widget.ProgressBar;
import android.widget.TextView;

public class CallOverlayService extends Service {
    static final String ACTION_SHOW = "app.liquidpay.overlay.SHOW";
    static final String ACTION_UPDATE = "app.liquidpay.overlay.UPDATE";
    static final String ACTION_HIDE = "app.liquidpay.overlay.HIDE";

    /** Hard ceiling so an overlay can never be stuck on screen. */
    private static final long WATCHDOG_MS = 90_000L;

    private static final int NAVY = Color.parseColor("#13212F");
    private static final int LIME = Color.parseColor("#E4F78A");
    private static final int MINT = Color.parseColor("#C4F2DC");
    private static final int SAGE = Color.parseColor("#F293A6A7");
    private static final int DANGER = Color.parseColor("#E2553D");

    private WindowManager wm;
    private View root;
    private TextView statusView;
    private final Handler main = new Handler(Looper.getMainLooper());
    private final Runnable watchdog = this::hide;

    static void show(Context c, Intent extras) {
        if (!Settings.canDrawOverlays(c)) return;
        Intent i = new Intent(c, CallOverlayService.class).setAction(ACTION_SHOW).putExtras(extras);
        c.startService(i);
    }

    static void update(Context c, String status, boolean banner) {
        if (!Settings.canDrawOverlays(c)) return;
        c.startService(new Intent(c, CallOverlayService.class).setAction(ACTION_UPDATE)
            .putExtra("status", status).putExtra("banner", banner));
    }

    static void hide(Context c) {
        c.startService(new Intent(c, CallOverlayService.class).setAction(ACTION_HIDE));
    }

    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        String action = intent == null ? null : intent.getAction();
        if (ACTION_SHOW.equals(action)) {
            build(intent, intent.getBooleanExtra("banner", false));
        } else if (ACTION_UPDATE.equals(action)) {
            boolean banner = intent.getBooleanExtra("banner", false);
            if (root == null || banner != Boolean.TRUE.equals(root.getTag())) {
                Intent merged = new Intent(intent);
                if (lastShow != null) merged.putExtras(lastShow);
                merged.putExtra("status", intent.getStringExtra("status"));
                build(merged, banner);
            } else if (statusView != null) {
                statusView.setText(intent.getStringExtra("status"));
            }
        } else if (ACTION_HIDE.equals(action)) {
            hide();
        }
        return START_NOT_STICKY;
    }

    private Intent lastShow;

    private int dp(float v) {
        return (int) TypedValue.applyDimension(TypedValue.COMPLEX_UNIT_DIP, v, getResources().getDisplayMetrics());
    }

    private GradientDrawable pill(int color, float radiusDp) {
        GradientDrawable d = new GradientDrawable();
        d.setColor(color);
        d.setCornerRadius(dp(radiusDp));
        return d;
    }

    private TextView text(String s, float sp, int color, boolean bold) {
        TextView t = new TextView(this);
        t.setText(s);
        t.setTextSize(TypedValue.COMPLEX_UNIT_SP, sp);
        t.setTextColor(color);
        if (bold) t.setTypeface(Typeface.DEFAULT_BOLD);
        return t;
    }

    private Button button(String label, int bg, int fg, View.OnClickListener l) {
        Button b = new Button(this);
        b.setText(label);
        b.setAllCaps(false);
        b.setTextColor(fg);
        b.setTextSize(TypedValue.COMPLEX_UNIT_SP, 16);
        b.setTypeface(Typeface.DEFAULT_BOLD);
        b.setBackground(pill(bg, 28));
        b.setOnClickListener(l);
        return b;
    }

    private void build(Intent in, boolean banner) {
        hideViews();
        if (!banner) lastShow = new Intent(in);
        wm = (WindowManager) getSystemService(WINDOW_SERVICE);

        String title = str(in, "title", "LiquidPay");
        String payee = str(in, "payee", "");
        String amount = str(in, "amount", "");
        String status = str(in, "status", "");
        String note = str(in, "note", "");
        String endLabel = str(in, "endCall", "End call");
        String openLabel = str(in, "openApp", "Open LiquidPay");

        LinearLayout card = new LinearLayout(this);
        card.setOrientation(LinearLayout.VERTICAL);
        card.setBackground(pill(NAVY, 32));
        int pad = dp(banner ? 16 : 24);
        card.setPadding(pad, pad, pad, pad);

        TextView brand = text("✱  " + title, 15, LIME, true);
        card.addView(brand);

        if (!banner) {
            TextView who = text(payee, 15, Color.argb(170, 255, 255, 255), false);
            who.setPadding(0, dp(18), 0, 0);
            card.addView(who);
            card.addView(text(amount, 44, Color.WHITE, true));
        }

        statusView = text(status, banner ? 15 : 17, Color.WHITE, true);
        statusView.setPadding(0, dp(banner ? 6 : 14), 0, dp(10));
        card.addView(statusView);

        if (!banner) {
            ProgressBar bar = new ProgressBar(this, null, android.R.attr.progressBarStyleHorizontal);
            bar.setIndeterminate(true);
            if (Build.VERSION.SDK_INT >= 21) bar.setIndeterminateTintList(android.content.res.ColorStateList.valueOf(LIME));
            card.addView(bar, new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, dp(8)));
            if (!note.isEmpty()) {
                TextView n = text(note, 13, MINT, false);
                n.setPadding(0, dp(12), 0, 0);
                card.addView(n);
            }
        }

        LinearLayout row = new LinearLayout(this);
        row.setOrientation(LinearLayout.HORIZONTAL);
        row.setPadding(0, dp(banner ? 4 : 20), 0, 0);
        LinearLayout.LayoutParams half = new LinearLayout.LayoutParams(0, dp(52), 1f);
        half.setMargins(dp(4), 0, dp(4), 0);
        if (!banner) {
            row.addView(button(endLabel, DANGER, Color.WHITE, v -> {
                LiquidPayPlugin.endCallStatic(this);
                LiquidPayPlugin.emitOverlayAction("endCall");
                hide();
            }), half);
        }
        row.addView(button(openLabel, LIME, NAVY, v -> {
            LiquidPayPlugin.bringAppToFront(this);
            if (banner) hide();
        }), half);
        card.addView(row);

        View content;
        WindowManager.LayoutParams lp;
        int type = Build.VERSION.SDK_INT >= 26
            ? WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY
            : WindowManager.LayoutParams.TYPE_PHONE;
        if (banner) {
            // Small card at the top: the user must be able to use the bank's call keypad below it.
            FrameLayout wrap = new FrameLayout(this);
            wrap.setPadding(dp(12), dp(40), dp(12), 0);
            wrap.addView(card);
            content = wrap;
            lp = new WindowManager.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT, type,
                WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE | WindowManager.LayoutParams.FLAG_LAYOUT_IN_SCREEN,
                PixelFormat.TRANSLUCENT);
            lp.gravity = Gravity.TOP;
        } else {
            // Full screen over the outgoing IVR call: the user doesn't need the dialer for this part.
            FrameLayout wrap = new FrameLayout(this);
            wrap.setBackgroundColor(SAGE);
            FrameLayout.LayoutParams c = new FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT, Gravity.CENTER);
            c.setMargins(dp(20), 0, dp(20), 0);
            wrap.addView(card, c);
            content = wrap;
            lp = new WindowManager.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT, type,
                WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE | WindowManager.LayoutParams.FLAG_LAYOUT_IN_SCREEN,
                PixelFormat.TRANSLUCENT);
        }
        content.setTag(banner);
        try {
            wm.addView(content, lp);
            root = content;
            main.removeCallbacks(watchdog);
            main.postDelayed(watchdog, WATCHDOG_MS);
        } catch (Exception e) {
            root = null; // permission revoked mid-flow: the app UI still works without the overlay
        }
    }

    private static String str(Intent i, String k, String d) {
        String v = i.getStringExtra(k);
        return v == null ? d : v;
    }

    private void hideViews() {
        if (root != null && wm != null) {
            try {
                wm.removeView(root);
            } catch (Exception ignored) {
            }
        }
        root = null;
        statusView = null;
    }

    private void hide() {
        main.removeCallbacks(watchdog);
        hideViews();
        stopSelf();
    }

    @Override
    public void onDestroy() {
        main.removeCallbacks(watchdog);
        hideViews();
        super.onDestroy();
    }
}
