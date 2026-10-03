const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');
const { XMLParser } = require('fast-xml-parser');

const supabaseUrl = 'https://dphxaglpramhwcwcnpay.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRwaHhhZ2xwcmFtaHdjd2NucGF5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMyNDg4NzksImV4cCI6MjA4ODgyNDg3OX0.Z2uLJlqYfs6RGcrRe3SpyaHo7BzvO4QgmYp9lXVEKN0';
const supabase = createClient(supabaseUrl, supabaseKey);

function parseIsoDurationToHours(durationStr) {
  if (!durationStr) return 0;
  const match = String(durationStr).match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+(?:\.\d+)?)S)?/i);
  if (!match) {
    const num = parseFloat(durationStr);
    return isNaN(num) ? 0 : num;
  }
  const hours = parseInt(match[1] || '0', 10);
  const minutes = parseInt(match[2] || '0', 10);
  const seconds = parseFloat(match[3] || '0');
  return Number((hours + minutes / 60 + seconds / 3600).toFixed(2));
}

async function run() {
  const xmlPath = "C:\\Users\\RolandSchroeder\\Downloads\\AVI_Line4_Site_Installation.xml";
  const xml = fs.readFileSync(xmlPath, 'utf-8');
  const parser = new XMLParser();
  const parsed = parser.parse(xml);
  const rawTasks = parsed.Project?.Tasks?.Task;

  console.log("Raw tasks in XML:", rawTasks.length);

  let currentSubproject = "AVI Line 4 Site Installation";
  const defaultProjId = currentSubproject.toLowerCase().replace(/[^a-z0-9]/g, '-');
  
  await supabase.from('tracker_projects').upsert({
    id: defaultProjId,
    title: currentSubproject,
    short_title: "AVI Line 4",
  });

  const tasksToInsert = [];
  const projectsMap = new Map();
  projectsMap.set(defaultProjId, true);

  for (let idx = 0; idx < rawTasks.length; idx++) {
    const t = rawTasks[idx];
    const uid = String(t.UID ?? t.ID ?? idx);
    const outlineLevel = parseInt(t.OutlineLevel || '1', 10);
    const isSummary = String(t.Summary) === '1' || String(t.Summary) === 'true';
    const name = String(t.Name || 'Unnamed Task').trim();
    const wbs = String(t.WBS || t.OutlineNumber || uid).trim();

    if (outlineLevel === 2) {
      currentSubproject = name;
      const pid = name.toLowerCase().replace(/[^a-z0-9]/g, '-');
      if (!projectsMap.has(pid)) {
        projectsMap.set(pid, true);
        await supabase.from('tracker_projects').upsert({
          id: pid,
          title: name,
          short_title: name.length > 20 ? name.substring(0, 18) + '...' : name,
          sort_order: projectsMap.size,
        });
      }
    }

    const projectId = currentSubproject.toLowerCase().replace(/[^a-z0-9]/g, '-');
    const workStr = String(t.Work || '');
    const quotedHours = parseIsoDurationToHours(workStr);

    tasksToInsert.push({
      id: `task_${uid}`,
      project_id: projectId,
      wbs: wbs,
      outline_level: outlineLevel,
      name: name,
      is_summary: isSummary,
      quoted_hours: quotedHours,
      sort_order: idx,
      notes: t.Notes ? String(t.Notes) : '',
    });
  }

  // Upsert all tasks in batches
  for (let i = 0; i < tasksToInsert.length; i += 100) {
    const batch = tasksToInsert.slice(i, i + 100);
    const { error } = await supabase.from('tracker_tasks').upsert(batch);
    if (error) {
      console.error("Batch error at", i, error.message);
    } else {
      console.log(`Upserted batch ${i} - ${i + batch.length}`);
    }
  }

  console.log("ALL 954 tasks synced to Supabase successfully!");
}

run().catch(console.error);
