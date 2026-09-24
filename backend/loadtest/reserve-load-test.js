// k6 run backend/loadtest/reserve-load-test.js
// Fires ramping concurrent load at either backend's /reserve endpoint.
// Set TARGET=java (default, port 8080/api) or TARGET=go (port 8081).
import http from 'k6/http';
import { check } from 'k6';
import { Counter } from 'k6/metrics';

const granted = new Counter('reservations_granted');
const rejected = new Counter('reservations_rejected');

const TARGET = __ENV.TARGET || 'go';
const BASE_URL = TARGET === 'go' ? 'http://localhost:8081' : 'http://localhost:8080/api';
const SALE_ID = __ENV.SALE_ID || '1';

export const options = {
  scenarios: {
    flash_sale_burst: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '10s', target: 500 },
        { duration: '20s', target: 2000 },
        { duration: '10s', target: 0 },
      ],
    },
  },
  thresholds: {
    http_req_duration: ['p(95)<500', 'p(99)<1000'],
  },
};

export default function () {
  const userId = `vu-${__VU}-${__ITER}`;
  const payload = TARGET === 'go'
    ? JSON.stringify({ saleId: SALE_ID, userId, quantity: 1, perUserLimit: 1 })
    : JSON.stringify({ quantity: 1 });

  const url = TARGET === 'go' ? `${BASE_URL}/reserve` : `${BASE_URL}/sales/${SALE_ID}/reserve`;
  const headers = { 'Content-Type': 'application/json' };
  if (TARGET !== 'go') headers['Idempotency-Key'] = userId;

  const res = http.post(url, payload, { headers });

  check(res, { 'status is 201 or 409': (r) => r.status === 201 || r.status === 409 });

  if (res.status === 201) granted.add(1);
  else rejected.add(1);
}
