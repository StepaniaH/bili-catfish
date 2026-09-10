import { readFileSync } from 'node:fs';
import crypto from 'node:crypto';

const key = JSON.parse(readFileSync(process.env.CWS_KEY_FILE, 'utf8'));
const publisher = process.env.CWS_PUBLISHER_ID;
const extension = process.env.CWS_EXTENSION_ID;
const [cmd, zipPath] = process.argv.slice(2);

const base = `https://chromewebstore.googleapis.com/v2/publishers/${publisher}/items/${extension}`;

async function accessToken() {
  const now = Math.floor(Date.now() / 1000);
  const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
  const input = `${b64({ alg: 'RS256', typ: 'JWT' })}.${b64({
    iss: key.client_email,
    scope: 'https://www.googleapis.com/auth/chromewebstore',
    aud: 'https://oauth2.googleapis.com/token',
    exp: now + 3600,
    iat: now,
  })}`;
  const signature = crypto
    .createSign('RSA-SHA256')
    .update(input)
    .sign(key.private_key, 'base64url');
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: `${input}.${signature}`,
    }),
  });
  const json = await res.json();
  if (!json.access_token) {
    throw new Error(`token exchange failed: ${JSON.stringify(json)}`);
  }
  return json.access_token;
}

const auth = { Authorization: `Bearer ${await accessToken()}` };

if (cmd === 'status') {
  const res = await fetch(`${base}:fetchStatus`, { headers: auth });
  console.log(`HTTP ${res.status}`);
  console.log(JSON.stringify(await res.json(), null, 2));
  process.exit(res.ok ? 0 : 1);
}

if (cmd === 'upload') {
  const res = await fetch(`${base}:upload?uploadType=media`, {
    method: 'POST',
    headers: { ...auth, 'content-type': 'application/zip' },
    body: readFileSync(zipPath),
  });
  console.log(`HTTP ${res.status}`);
  console.log(JSON.stringify(await res.json(), null, 2));
  process.exit(res.ok ? 0 : 1);
}

if (cmd === 'publish') {
  const res = await fetch(`${base}:submitForReview`, { method: 'POST', headers: auth });
  console.log(`HTTP ${res.status}`);
  console.log(JSON.stringify(await res.json(), null, 2));
  process.exit(res.ok ? 0 : 1);
}

console.error('unknown command: expected status | upload <zip> | publish');
process.exit(2);
