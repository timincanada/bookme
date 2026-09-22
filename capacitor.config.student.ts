import type { CapacitorConfig } from "@capacitor/cli";

// Student-only Capacitor shell (TestFlight / Play internal testing).
// Coach app stays on capacitor.config.ts → ios/ + android/.
// Loads the live student portal; native-shell-student is the offline fallback.
const config: CapacitorConfig = {
  appId: "app.bookme.student",
  appName: "BookMe Student",
  webDir: "native-shell-student",
  server: {
    url: process.env.BOOKME_STUDENT_APP_SERVER_URL || "https://bookme.training/manage",
    errorPath: "index.html",
    allowNavigation: [
      "bookme.training",
      "www.bookme.training",
      "checkout.stripe.com",
      "connect.stripe.com",
      "*.stripe.com",
    ],
  },
  appendUserAgent: "BookMeStudentApp",
  backgroundColor: "#f6f1e7",
  ios: {
    path: "ios-student",
    contentInset: "automatic",
    limitsNavigationsToAppBoundDomains: false,
  },
  android: {
    path: "android-student",
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
