const fs = require('fs');

async function testFull() {
  const t0 = Date.now();
  const res = await fetch('https://protemp-project-tracker.vercel.app/api/onedrive-sync', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ fileName: 'Master Project.xml' }),
  });
  const data = await res.json();
  console.log(`Serverless duration: ${Date.now() - t0}ms, status: ${res.status}`);
  console.log(data);
}

testFull();
