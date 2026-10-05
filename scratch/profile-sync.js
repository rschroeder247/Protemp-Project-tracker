const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');

async function profileSync() {
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

  const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const supabase = createClient(supabaseUrl, supabaseKey);

  console.log('1. Testing subproject upserts...');
  const t0 = Date.now();
  const subprojectNames = [
    'Master Project',
    'Sub 1', 'Sub 2', 'Sub 3', 'Sub 4', 'Sub 5', 'Sub 6', 'Sub 7', 'Sub 8'
  ];
  for (let i = 0; i < subprojectNames.length; i++) {
    const spName = subprojectNames[i];
    const isMaster = spName === 'Master Project';
    const spId = spName.toLowerCase().replace(/[^a-z0-9]/g, '-');
    await supabase.from('tracker_projects').upsert({
      id: spId,
      title: spName,
      short_title: spName,
      is_subproject: !isMaster,
      sort_order: i,
    });
  }
  console.log(`Subprojects upserted sequentially in ${Date.now() - t0}ms`);

  console.log('2. Testing existing tasks query...');
  const t1 = Date.now();
  const { data: existing } = await supabase
    .from('tracker_tasks')
    .select('id')
    .limit(1000);
  console.log(`Existing tasks fetched (${existing.length}) in ${Date.now() - t1}ms`);

  console.log('3. Testing existing progress query...');
  const t2 = Date.now();
  const { data: prog } = await supabase
    .from('tracker_task_progress')
    .select('task_id, done_by_name, ticked_at');
  console.log(`Existing progress fetched (${prog.length}) in ${Date.now() - t2}ms`);
}

profileSync();
