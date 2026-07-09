import type { CapacitorConfig } from "@capacitor/cli";

// Native iOS shell for Hammerbid. The app loads the deployed site, so the
// full stack — server actions, Supabase auth, Stripe — works exactly as on
// the web, and web deploys update the app instantly.
const config: CapacitorConfig = {
  appId: "com.hammerbid.app",
  appName: "Hammerbid",
  // TODO: replace with your production domain from Vercel before building.
  server: {
    url: "https://hammerbid.vercel.app",
    allowNavigation: ["*.supabase.co", "*.stripe.com"],
  },
  ios: {
    contentInset: "automatic",
    backgroundColor: "#0c0f14",
  },
  // Unused in remote-URL mode but required by the CLI.
  webDir: "public",
};

export default config;
