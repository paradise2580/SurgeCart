// Runtime API configuration, read by environment.prod.ts before the Angular
// bundle boots. Overwritten at deploy time by scripts-write-env.mjs from the
// API_BASE_URL / WS_BASE_URL environment variables (see vercel.json).
// Defaults below target a local Docker Compose run.
window.__env = {
  apiBaseUrl: "http://localhost:8080/api",
  wsUrl: "http://localhost:8080/ws"
};
