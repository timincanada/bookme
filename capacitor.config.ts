import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "training.bookme.app",
  appName: "BookMe",
  webDir: "public",
  server: {
    url: "https://bookme-flax.vercel.app",
    androidScheme: "https",
    allowNavigation: [
      "bookme-flax.vercel.app",
      "bookme.training",
      "www.bookme.training",
      "*.stripe.com",
      "*.vercel.app",
    ],
  },
  plugins: {
    SplashScreen: {
      backgroundColor: "#10B981",
      launchAutoHide: true,
    },
    StatusBar: {
      backgroundColor: "#10B981",
    },
  },
};

export default config;
