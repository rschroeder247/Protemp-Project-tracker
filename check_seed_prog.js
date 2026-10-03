const fs = require('fs');
const seed = JSON.parse(fs.readFileSync('C:\\Temp\\Antigravity\\Unpacked\\seed-data.json', 'utf-8'));
console.log('Seed progress count:', seed.progress.length);
console.log('Sample progress:', JSON.stringify(seed.progress.slice(0, 3), null, 2));
