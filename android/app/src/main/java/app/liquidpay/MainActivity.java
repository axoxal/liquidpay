package app.liquidpay;

import android.os.Bundle;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(LiquidPayPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
