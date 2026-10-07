/* Kept 관리자 — 설정
   앱(v2/config.js)과 같은 Supabase 주소와 PUBLIC anon 키를 넣습니다.
   service_role 키는 절대 여기에 넣지 마세요. 관리자 권한은 서버(admin-api)가 판단합니다. */
window.KEPT_ADMIN_CONFIG = {
  SUPABASE_URL: "https://ymlrigkobbhoylbyvyoo.supabase.co",
  SUPABASE_ANON_KEY: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InltbHJpZ2tvYmJob3lsYnl2eW9vIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTA4MDUzMDYsImV4cCI6MjEwNjM4MTMwNn0.Ixs9t-hJI5Ksuw9pckJ0dbkK49RAhuLXewiCVbhNuJ8",
  PRICES: { monthly: 3.99, yearly: 39.9, currency: "USD" }   // 예상 월 매출 계산용 (실제 금액은 Paddle 대시보드 기준)
};
