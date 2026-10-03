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

function calculateTreeStats(tasks) {
  let totalLeafTasks = 0;
  let completedLeafTasks = 0;
  let totalQuotedHours = 0;
  let earnedHours = 0;

  function traverse(node) {
    if (!node.isSummary) {
      totalLeafTasks += 1;
      const hrs = Number(node.quotedHours) || 0;
      totalQuotedHours += hrs;
      if (node.isLocked) {
        completedLeafTasks += 1;
        earnedHours += hrs;
      }
    }
    if (node.children && node.children.length > 0) {
      for (const child of node.children) {
        traverse(child);
      }
    }
  }

  for (const t of tasks) {
    traverse(t);
  }

  const hoursPct = totalQuotedHours > 0 ? (earnedHours / totalQuotedHours) * 100 : 0;

  return {
    totalLeafTasks,
    completedLeafTasks,
    totalQuotedHours: Number(totalQuotedHours.toFixed(1)),
    earnedHours: Number(earnedHours.toFixed(1)),
    hoursPct: Number(hoursPct.toFixed(1)),
  };
}

async function testPageLogic() {
  const { data: dbTasks } = await supabase
    .from('tracker_tasks')
    .select('*')
    .order('sort_order', { ascending: true })
    .limit(3000);

  const flatNodes = dbTasks.map(t => ({
    id: t.id,
    wbs: t.wbs,
    outlineLevel: t.outline_level,
    name: t.name,
    isSummary: t.is_summary,
    quotedHours: Number(t.quoted_hours) || 0,
  }));

  const allTasks = buildTaskTree(flatNodes);
  console.log("allTasks count:", allTasks.length);

  // Clean sections extraction
  // Find the real project tree (the one with children)
  const mainProject = allTasks.find(t => t.children && t.children.length > 0);
  const sections = mainProject ? mainProject.children : allTasks;

  console.log("Sections count:", sections.length);
  for (const s of sections) {
    const stats = calculateTreeStats([s]);
    console.log(`Section: "${s.name}" -> ${stats.totalLeafTasks} tasks, ${stats.totalQuotedHours} hours`);
  }

  const allStats = calculateTreeStats(sections);
  console.log("TOTAL STATS:", allStats);
}

testPageLogic();
