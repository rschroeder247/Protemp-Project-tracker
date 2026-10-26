import fs from 'fs';
import { parseMsProjectXml } from '../src/lib/msproject-xml';
import { syncProjectTreeToSupabase } from '../src/lib/msproject';

const SP_NAME = 'AVI Line 4 – Trailing Cable Isolator to Motor';
const spId = SP_NAME.toLowerCase().replace(/[^a-z0-9]/g, '-');
const prefix = spId.substring(0, 32);

const xml = fs.readFileSync(process.env.TEMP + '\\trailing_cable.xml', 'utf8');
const parsed = parseMsProjectXml(xml);

const tasks = [
  {
    id: 'sp_50', projectId: spId, projectName: 'Master Project', subprojectName: SP_NAME,
    wbs: '4', outlineLevel: 1, name: SP_NAME, isSummary: true,
    quotedHours: parsed.tasks[0]?.quotedHours || 0, durationDays: 0, notes: '', percentComplete: 0,
  },
  ...parsed.tasks.map((t) => ({
    ...t,
    id: `task_${prefix}_${t.id}`,
    projectId: spId,
    projectName: 'Master Project',
    subprojectName: SP_NAME,
    outlineLevel: t.outlineLevel + 1,
  })),
];

(async () => {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://dphxaglpramhwcwcnpay.supabase.co';
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
  const res = await syncProjectTreeToSupabase(url, key, 'Master Project', tasks as any);
  console.log('Synced', res.count, 'tasks for', spId);
  process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });

