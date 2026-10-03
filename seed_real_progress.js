const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');

const url = 'https://dphxaglpramhwcwcnpay.supabase.co';
const anon = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRwaHhhZ2xwcmFtaHdjd2NucGF5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMyNDg4NzksImV4cCI6MjA4ODgyNDg3OX0.Z2uLJlqYfs6RGcrRe3SpyaHo7BzvO4QgmYp9lXVEKN0';
const supabase = createClient(url, anon);

const STAGE_NAME_MAP = {
  materials: 'Materials on site',
  cableInstalled: 'Cable run / installed',
  glanded: 'Cable glanded (both ends)',
  jbBuilt: 'JB built',
  labels: 'Cable labels fitted',
  termJB: 'Terminated at JB (sequential)',
  termMCC: 'Terminated at MCC (scattered)',
};

async function seedProgress() {
  const seed = JSON.parse(fs.readFileSync('C:\\Temp\\Antigravity\\Unpacked\\seed-data.json', 'utf-8'));
  console.log("Seed progress items:", seed.progress.length);

  // Get all tasks to find task_id by item and stage
  const { data: tasks } = await supabase
    .from('tracker_tasks')
    .select('id, name, wbs, outline_level')
    .limit(3000);

  // Build map of itemTag -> stageName -> taskId
  const taskMap = new Map();
  let currentItemTag = '';

  for (const t of tasks) {
    if (t.outline_level === 3) {
      // e.g. "DJB-ZONE111-01 - 1000 x 800 x 330" -> tag is before "-"
      currentItemTag = t.name.split('-')[0].trim();
      const fullTag = t.name.split(' - ')[0].trim();
      if (!taskMap.has(fullTag)) taskMap.set(fullTag, new Map());
    } else if (t.outline_level === 4) {
      for (const [tag, stageMap] of taskMap.entries()) {
        if (t.wbs.startsWith(tasks.find(x => x.name.startsWith(tag))?.wbs + '.')) {
          stageMap.set(t.name.toLowerCase(), t.id);
        }
      }
    }
  }

  const progressRows = [];
  for (const p of seed.progress) {
    const stageExpectedName = STAGE_NAME_MAP[p.stage_key] || p.stage_key;
    const stageMap = taskMap.get(p.item_id);
    let matchedTaskId = null;

    if (stageMap) {
      for (const [sName, tid] of stageMap.entries()) {
        if (sName.includes(stageExpectedName.toLowerCase().slice(0, 10))) {
          matchedTaskId = tid;
          break;
        }
      }
    }

    if (!matchedTaskId) {
      // Find directly
      const direct = tasks.find(t => 
        t.outline_level === 4 && 
        t.name.toLowerCase().includes(stageExpectedName.toLowerCase().slice(0, 8)) &&
        tasks.find(parent => parent.outline_level === 3 && parent.name.startsWith(p.item_id) && t.wbs.startsWith(parent.wbs + '.'))
      );
      if (direct) matchedTaskId = direct.id;
    }

    if (matchedTaskId) {
      progressRows.push({
        task_id: matchedTaskId,
        project_id: 'muyang-jb-panels--quote-114843-',
        done_by_name: p.done_by_name || 'Lindani',
        ticked_at: p.ticked_at || new Date().toISOString(),
        saved_at: p.saved_at || new Date().toISOString(),
      });
    }
  }

  console.log("Matched progress rows to seed:", progressRows.length);
  if (progressRows.length > 0) {
    const { error } = await supabase.from('tracker_task_progress').upsert(progressRows);
    if (error) console.error("Error inserting progress:", error);
    else console.log("Successfully seeded progress rows into tracker_task_progress!");
  }
}

seedProgress().catch(console.error);
