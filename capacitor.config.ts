import type { CapacitorConfig } from "@capacitor/cli";

// The apps load the live site (server-rendered); native-shell holds only the
// offline page shown when that load fails.
const config: CapacitorConfig = {
  appId: "app.bookme.training",
  appName: "BookMe",
  webDir: "native-shell",
  server: {
    url: process.env.BOOKME_APP_SERVER_URL || "https://bookme.training/welcome",
    errorPath: "index.html",
    allowNavigation: ["bookme.training", "www.bookme.training", "checkout.stripe.com", "connect.stripe.com", "*.stripe.com"],
  },
  appendUserAgent: "BookMeApp",
  backgroundColor: "#f6f1e7",
  ios: {
    contentInset: "automatic",
    limitsNavigationsToAppBoundDomains: false,
  },
  android: {
    allowMixedContent: false,
  },
  plugins: {
    SplashScreen: {
      launchAutoHide: false,
      backgroundColor: "#f6f1e7",
      showSpinner: false,
    },
    PushNotifications: {
      presentationOptions: ["badge", "sound", "alert"],
    },
  },
};

export default config;
