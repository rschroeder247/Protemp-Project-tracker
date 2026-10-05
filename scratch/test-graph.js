const fs = require('fs');

async function test() {
  const envContent = fs.readFileSync('.env.local', 'utf-8');
  const env = {};
  envContent.split('\n').forEach(line => {
    const idx = line.indexOf('=');
    if (idx > 0) {
      const k = line.slice(0, idx).trim();
      const v = line.slice(idx + 1).trim();
      env[k] = v;
    }
  });

  const tenantId = env.MS_TENANT_ID;
  const clientId = env.MS_CLIENT_ID;
  const clientSecret = env.MS_CLIENT_SECRET;

  console.log('Fetching token...');
  const t0 = Date.now();
  const tokenRes = await fetch(`https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      scope: 'https://graph.microsoft.com/.default',
      grant_type: 'client_credentials',
    }).toString(),
  });
  const tokenData = await tokenRes.json();
  console.log(`Token fetched in ${Date.now() - t0}ms`);
  const token = tokenData.access_token;

  const knownDriveId = 'b!aJuWp9LDrU21DuedJYC4tY_NzGRevhlNm5XuWgvDqs1wyQwrTeW9RLE212NNjDCH';
  const fileName = 'Master Project.xml';

  const t1 = Date.now();
  console.log('Testing fast path...');
  const metaRes = await fetch(
    `https://graph.microsoft.com/v1.0/drives/${knownDriveId}/root:/Protemp%20Operations/MS%20Project/${encodeURIComponent(fileName)}`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  console.log(`Meta status: ${metaRes.status} in ${Date.now() - t1}ms`);
  if (metaRes.ok) {
    const meta = await metaRes.json();
    console.log('Found meta:', meta.name, meta.lastModifiedDateTime, meta.id);
    const t2 = Date.now();
    const contentRes = await fetch(
      `https://graph.microsoft.com/v1.0/drives/${knownDriveId}/items/${meta.id}/content`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    console.log(`Content status: ${contentRes.status} in ${Date.now() - t2}ms, content length: ${contentRes.headers.get('content-length')}`);
    const text = await contentRes.text();
    console.log(`Text read: ${text.length} chars in ${Date.now() - t2}ms`);
  } else {
    const errText = await metaRes.text();
    console.log('Meta failed:', errText);
  }
}

test();
