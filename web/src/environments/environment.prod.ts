// Vercel serves static files, so build-time env vars would bake the API URL
// into the bundle at build time — awkward if the backend URL ever changes
// without a rebuild. Instead, public/env-config.js sets window.__env before
// the Angular bundle loads, and this file just reads it at runtime. See the
// README deployment section for how Vercel writes env-config.js.
declare global {
  interface Window {
    __env?: { apiBaseUrl?: string; wsUrl?: string };
  }
}

export const environment = {
  production: true,
  apiBaseUrl: window.__env?.apiBaseUrl ?? '/api',
  wsUrl: window.__env?.wsUrl ?? '/ws',
};
