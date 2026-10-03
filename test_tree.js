const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://dphxaglpramhwcwcnpay.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRwaHhhZ2xwcmFtaHdjd2NucGF5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMyNDg4NzksImV4cCI6MjA4ODgyNDg3OX0.Z2uLJlqYfs6RGcrRe3SpyaHo7BzvO4QgmYp9lXVEKN0';
const supabase = createClient(supabaseUrl, supabaseKey);

function buildTaskTree(flatTasks) {
  const rootNodes = [];
  const stack = [];

  for (const task of flatTasks) {
    const node = { ...task, children: [] };

    while (stack.length > 0 && stack[stack.length - 1].outlineLevel >= node.outlineLevel) {
      stack.pop();
    }

    if (stack.length === 0) {
      rootNodes.push(node);
    } else {
      const parent = stack[stack.length - 1];
      if (!parent.children) parent.children = [];
      parent.children.push(node);
    }

    if (node.isSummary) {
      stack.push(node);
    }
  }

  return rootNodes;
}

async function check() {
  const { data: tasks, error } = await supabase
    .from('tracker_tasks')
    .select('*')
    .order('sort_order', { ascending: true })
    .limit(2000);

  if (error) {
    console.error("Fetch error:", error);
    return;
  }

  console.log("Total tasks in DB:", tasks.length);
  const flatNodes = tasks.map(t => ({
    id: t.id,
    wbs: t.wbs,
    outlineLevel: t.outline_level,
    name: t.name,
    isSummary: t.is_summary,
    quotedHours: Number(t.quoted_hours) || 0,
  }));

  const tree = buildTaskTree(flatNodes);
  console.log("Root nodes count:", tree.length);
  for (const r of tree) {
    console.log(` - Root: [${r.wbs}] ${r.name} (Children: ${r.children ? r.children.length : 0})`);
    if (r.children) {
      for (const c of r.children.slice(0, 4)) {
        console.log(`    * [${c.wbs}] ${c.name} (${c.children ? c.children.length : 0} stages)`);
      }
      if (r.children.length > 4) {
        console.log(`    * ... and ${r.children.length - 4} more items`);
      }
    }
  }
}

check();
