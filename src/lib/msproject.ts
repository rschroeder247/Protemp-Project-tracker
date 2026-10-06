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
  percentComplete?: number;
}

export async function syncProjectTreeToSupabase(
  supabaseUrl: string,
  supabaseKey: string,
  projectName: string,
  tasks: RawProjectTask[]
) {
  const supabase = createClient(supabaseUrl, supabaseKey);

  // 1. Ensure master and subprojects exist in tracker_projects first to satisfy foreign keys
  const subprojectNames = Array.from(new Set(tasks.map((t) => t.subprojectName || projectName)));

  const projRows = subprojectNames.map((spName, i) => {
    const isMaster = spName === projectName;
    const spId = spName.toLowerCase().replace(/[^a-z0-9]/g, '-');
    return {
      id: spId,
      title: spName,
      short_title: spName.length > 20 ? spName.substring(0, 18) + '...' : spName,
      is_subproject: !isMaster,
      sort_order: i,
    };
  });

  const { error: projError } = await supabase.from('tracker_projects').upsert(projRows);
  if (projError) {
    console.warn('Warning upserting projects:', projError);
  }

  // 2. Prepare task rows with consistent 'task_' ID prefix matching existing database schema
  const rows = tasks.map((t, idx) => {
    const spId = (t.subprojectName || projectName).toLowerCase().replace(/[^a-z0-9]/g, '-');
    const taskId = t.id.startsWith('task_') ? t.id : `task_${t.id}`;
    return {
      id: taskId,
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

  // 3. Batch upsert in parallel chunks
  const CHUNK_SIZE = 1000;
  const chunks: (typeof rows)[] = [];
  for (let i = 0; i < rows.length; i += CHUNK_SIZE) {
    chunks.push(rows.slice(i, i + CHUNK_SIZE));
  }

  await Promise.all(
    chunks.map(async (chunk, idx) => {
      const { error } = await supabase.from('tracker_tasks').upsert(chunk);
      if (error) {
        throw new Error(`Failed to upsert tasks chunk ${idx}: ${error.message}`);
      }
    })
  );

  // 3b. Automatically prune deleted/obsolete tasks that no longer exist in MS Project
  // Only prune for subprojects that actually had their full child tree exported (> 1 tasks)
  // to avoid accidentally wiping tasks if a subproject was collapsed in MS Project.
  const projectTaskCounts = new Map<string, number>();
  for (const r of rows) {
    projectTaskCounts.set(r.project_id, (projectTaskCounts.get(r.project_id) || 0) + 1);
  }

  const fullyExportedProjectIds = Array.from(projectTaskCounts.entries())
    .filter(([_, count]) => count > 1)
    .map(([pid]) => pid);

  const activeTaskIdSet = new Set(rows.map((r) => r.id));

  if (fullyExportedProjectIds.length > 0) {
    // Fast check: only search for obsolete tasks if DB count exceeds incoming active task count
    const { count: totalDbCount } = await supabase
      .from('tracker_tasks')
      .select('id', { count: 'exact', head: true })
      .in('project_id', fullyExportedProjectIds);

    if (totalDbCount && totalDbCount > rows.length) {
      const existingIds: string[] = [];
      let from = 0;
      while (true) {
        const { data, error } = await supabase
          .from('tracker_tasks')
          .select('id')
          .in('project_id', fullyExportedProjectIds)
          .range(from, from + 999);
        if (error || !data || data.length === 0) break;
        existingIds.push(...data.map((d: any) => d.id));
        if (data.length < 1000) break;
        from += 1000;
      }

      const toDeleteIds = existingIds.filter((id) => !activeTaskIdSet.has(id));

      if (toDeleteIds.length > 0) {
        // Remove any progress records first to maintain foreign key integrity
        await supabase
          .from('tracker_task_progress')
          .delete()
          .in('task_id', toDeleteIds);

        // Remove obsolete tasks
        await supabase
          .from('tracker_tasks')
          .delete()
          .in('id', toDeleteIds);
      }
    }
  }

  // 4. Also sync progress for leaf tasks that are 100% complete in MS Project
  const completedLeafTasks = tasks.filter(
    (t) => !t.isSummary && (t.percentComplete || 0) >= 100
  );

  if (completedLeafTasks.length > 0) {
    const { data: existingProg } = await supabase
      .from('tracker_task_progress')
      .select('task_id, done_by_name, ticked_at');

    const existingMap = new Map((existingProg || []).map((p) => [p.task_id, p]));

    const progressRows = completedLeafTasks.map((t) => {
      const taskId = t.id.startsWith('task_') ? t.id : `task_${t.id}`;
      const spId = (t.subprojectName || projectName).toLowerCase().replace(/[^a-z0-9]/g, '-');
      const existing = existingMap.get(taskId);

      return {
        task_id: taskId,
        project_id: spId,
        done_by_name: existing?.done_by_name || 'Lindani (Site Team)',
        ticked_at: existing?.ticked_at || '2026-10-01T17:13:00+00:00',
        saved_at: new Date().toISOString(),
      };
    });

    const progChunks: (typeof progressRows)[] = [];
    for (let i = 0; i < progressRows.length; i += CHUNK_SIZE) {
      progChunks.push(progressRows.slice(i, i + CHUNK_SIZE));
    }
    await Promise.all(
      progChunks.map(async (pChunk) => {
        const { error: progErr } = await supabase.from('tracker_task_progress').upsert(pChunk);
        if (progErr) {
          console.warn('Notice upserting completed progress from MS Project:', progErr);
        }
      })
    );
  }

  return { success: true, count: rows.length };
}
