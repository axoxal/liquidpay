import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "app.liquidpay",
  appName: "LiquidPay",
  // The same static export Vercel serves; bundled so the app works with no internet.
  webDir: "out",
  android: {
    backgroundColor: "#93a6a7",
    allowMixedContent: false,
  },
};

export default config;
