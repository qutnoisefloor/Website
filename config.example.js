window.NOISE_FLOOR_CONFIG = {
  // Copy this file to config.js and replace these placeholders
  // with your own Supabase project credentials.

  supabaseUrl: "YOUR_SUPABASE_URL",
  supabaseAnonKey: "YOUR_SUPABASE_ANON_KEY",

  // Change this if your GitHub repository name changes.
  basePath: "/Club-Website",

  siteName: "Noise Floor",
  tagline: "music · electronics · waves",

  analytics: {
    enabled: true,
    visitorIdStorageKey: "noise_floor_visitor_id"
  },

  qr: {
    routePrefix: "/r/"
  }
};
