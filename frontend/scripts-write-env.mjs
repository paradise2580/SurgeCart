// Writes public/env-config.js from Vercel environment variables BEFORE the
// Angular build, so the API URL is injected without hardcoding it in the
// bundle. Set API_BASE_URL and WS_BASE_URL in Vercel project settings.
import { writeFileSync, mkdirSync } from 'node:fs';

const api = process.env.API_BASE_URL || 'http://localhost:8080/api';
const ws = process.env.WS_BASE_URL || 'http://localhost:8080/ws';

mkdirSync('public', { recursive: true });
writeFileSync(
  'public/env-config.js',
  `window.__env = {\n  apiBaseUrl: ${JSON.stringify(api)},\n  wsUrl: ${JSON.stringify(ws)}\n};\n`
);

console.log(`env-config.js written -> api=${api} ws=${ws}`);
