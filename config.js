window.NOISE_FLOOR_CONFIG = {
  // Supabase project details.
  // We'll fill these in when we set up Supabase.
  supabaseUrl: "YOUR_SUPABASE_URL",
  supabaseAnonKey: "YOUR_SUPABASE_ANON_KEY",

  // GitHub Pages repository path.
  // Your repo is currently called Club-Website.
  basePath: "/Club-Website",

  // Basic site settings.
  siteName: "Noise Floor",
  tagline: "music · electronics · waves",

  // Analytics settings.
  analytics: {
    enabled: true,

    // How long a browser counts as the same visitor.
    visitorIdStorageKey: "noise_floor_visitor_id"
  },

  // QR routing.
  qr: {
    routePrefix: "/r/"
  }
};
