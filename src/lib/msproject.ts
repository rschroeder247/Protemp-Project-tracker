/**
 * MS Project Sync Service
 * Parses exported task trees from MS Project (Master + Subprojects)
 * and upserts them into Supabase tables: tracker_projects and tracker_tasks.
 */

import { createClient } from '@supabase/supabase-js';

export interface RawProjectTask {
  id: string;
  projectId: string;
  projectName: string;
  subprojectName: string;
  wbs: string;
  outlineLevel: number;
  name: string;
  isSummary: boolean;
  quotedHours: number;
  durationDays?: number;
  notes?: string;
}

export async function syncProjectTreeToSupabase(
  supabaseUrl: string,
  supabaseKey: string,
  projectName: string,
  tasks: RawProjectTask[]
) {
  const supabase = createClient(supabaseUrl, supabaseKey);

  // 1. Ensure master and subprojects exist
  const subprojectNames = Array.from(new Set(tasks.map((t) => t.subprojectName || projectName)));

  for (let i = 0; i < subprojectNames.length; i++) {
    const spName = subprojectNames[i];
    const isMaster = spName === projectName;
    const spId = spName.toLowerCase().replace(/[^a-z0-9]/g, '-');

    await supabase.from('tracker_projects').upsert({
      id: spId,
      title: spName,
      short_title: spName.length > 20 ? spName.substring(0, 18) + '...' : spName,
      is_subproject: !isMaster,
      sort_order: i,
    });
  }

  // 2. Upsert tasks with flexible WBS tree structure
  const rows = tasks.map((t, idx) => {
    const spId = (t.subprojectName || projectName).toLowerCase().replace(/[^a-z0-9]/g, '-');
    return {
      id: `${spId}_${t.wbs || idx}`,
      project_id: spId,
      wbs: t.wbs || `${idx + 1}`,
      outline_level: t.outlineLevel || 1,
      name: t.name,
      is_summary: t.isSummary,
      quoted_hours: t.quotedHours || 0,
      duration_days: t.durationDays || 0,
      sort_order: idx,
      notes: t.notes || '',
    };
  });

  const { error } = await supabase.from('tracker_tasks').upsert(rows);
  if (error) {
    throw new Error(`Failed to upsert tasks: ${error.message}`);
  }

  return { success: true, count: rows.length };
}
