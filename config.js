/* ============================ CONFIGURATION ============================
   Fill these in before deploying. Leave SUPABASE_* empty to run in
   device-only mode (or let each user paste a connection in Settings).
   Only ever use the PUBLIC anon key here — never the service_role key.
   ======================================================================= */
window.KEPT_CONFIG = {
  SUPABASE_URL: "https://ymlrigkobbhoylbyvyoo.supabase.co",
  SUPABASE_ANON_KEY: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InltbHJpZ2tvYmJob3lsYnl2eW9vIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTA4MDUzMDYsImV4cCI6MjEwNjM4MTMwNn0.Ixs9t-hJI5Ksuw9pckJ0dbkK49RAhuLXewiCVbhNuJ8",
  OPERATOR: "Andrew Lee",            // shown in Privacy Policy / Terms
  PRIVACY_CONTACT: "24story@gmail.com",     // e.g. privacy@yourdomain.com
  SITE_URL: "",                          // public address used by "Tell people about Kept" (empty: this site's address)
  SUBSCRIBE: {                           // Paddle Billing — Free / monthly / yearly. Empty values keep checkout off.
    environment: "sandbox",              // "sandbox" while testing, "production" when live
    clientToken: "",                     // Paddle → Developer tools → Authentication → client-side token (test_… / live_…)
    prices: { monthly: "", yearly: "" }, // Paddle price IDs (pri_…): $3.99 / month, $39.90 / year
    display: { monthly: 3.99, yearly: 39.9, currency: "USD" }  // what the plan cards show (Paddle shows the final local price at checkout)
  }
};
