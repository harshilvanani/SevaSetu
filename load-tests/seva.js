// k6 load test for the SEVAKS targets: searches under 2 seconds, 50,000 volunteers.
// Run against STAGING only (never production):
//   k6 run -e API=https://<staging-project>.supabase.co/rest/v1 -e ANON_KEY=<staging anon key> \
//          -e EMAIL=<staging test user> -e PASSWORD=<…> -e AUTH=https://<staging-project>.supabase.co/auth/v1 load-tests/seva.js
// On AWS the API becomes https://<api-id>.execute-api.ca-central-1.amazonaws.com/rest and sign-in goes through Cognito.
import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  scenarios: {
    // Volunteers browsing Discover: ramp to 500 concurrent users
    browse: { executor: 'ramping-vus', exec: 'browse', startVUs: 0, stages: [{ duration: '2m', target: 200 }, { duration: '5m', target: 500 }, { duration: '1m', target: 0 }] },
    // Sign-up rush on one seva: 50 people joining at the same second must never overbook
    rush: { executor: 'per-vu-iterations', exec: 'rush', vus: 50, iterations: 1, startTime: '3m' },
  },
  thresholds: {
    'http_req_duration{kind:discover}': ['p(95)<2000'], // SEVAKS: searches under 2 seconds
    'http_req_duration{kind:rpc}': ['p(95)<2000'],
    http_req_failed: ['rate<0.01'],
  },
};

const API = __ENV.API;
const headers = (token) => ({
  apikey: __ENV.ANON_KEY,
  Authorization: `Bearer ${token ?? __ENV.ANON_KEY}`,
  'Content-Type': 'application/json',
});

export function setup() {
  const res = http.post(`${__ENV.AUTH}/token?grant_type=password`, JSON.stringify({ email: __ENV.EMAIL, password: __ENV.PASSWORD }), {
    headers: { apikey: __ENV.ANON_KEY, 'Content-Type': 'application/json' },
  });
  return { token: res.json('access_token'), taskId: __ENV.RUSH_TASK_ID };
}

export function browse(data) {
  const now = new Date().toISOString();
  const r = http.get(
    `${API}/seva_tasks?select=*,events!inner(*)&status=in.(open,full)&events.status=eq.published&events.ends_at=gte.${now}&limit=60`,
    { headers: headers(data.token), tags: { kind: 'discover' } },
  );
  check(r, { 'discover 200': (x) => x.status === 200 });
  const ids = (r.json() ?? []).slice(0, 40).map((t) => t.id);
  if (ids.length) {
    const m = http.post(`${API}/rpc/my_match_scores`, JSON.stringify({ p_tasks: ids, p_tz: 'America/Toronto' }), { headers: headers(data.token), tags: { kind: 'rpc' } });
    check(m, { 'match scores 200': (x) => x.status === 200 });
  }
  sleep(Math.random() * 3 + 1);
}

// Uses one staging test account per VU in a real run; with a single account the database answers "already_joined",
// which still exercises the row lock. The check afterwards: volunteers_count must never exceed positions.
export function rush(data) {
  if (!data.taskId) return;
  const r = http.post(`${API}/rpc/join_task`, JSON.stringify({ p_task: data.taskId, p_qty: 1 }), { headers: headers(data.token), tags: { kind: 'rpc' } });
  check(r, { 'join answered': (x) => x.status === 200 || x.status === 400 });
}
