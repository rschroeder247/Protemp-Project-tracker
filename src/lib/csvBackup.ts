import { supabase, fetchAllTasks } from './supabase';

export interface BackupProgressRecord {
  taskId: string;
  wbs: string;
  outlineLevel: number;
  isSummary: boolean;
  taskName: string;
  subprojectId: string;
  subprojectName: string;
  parentTaskId: string;
  sortOrder: number;
  quotedHours: number;
  durationDays: number;
  notes: string;
  status: 'Completed' | 'Pending' | 'Heading';
  percentComplete: number;
  doneByName: string;
  tickedAt: string;
  savedAt: string;
}

export interface RestoreResult {
  success: boolean;
  totalInFile: number;
  tasksRestoredCount: number;
  restoredCount: number;
  skippedCount: number;
  errors?: string[];
  message: string;
}

/**
 * Escapes a single CSV cell according to RFC 4180
 */
function escapeCsv(val: any): string {
  if (val === null || val === undefined) return '""';
  const str = String(val);
  if (str.includes('"') || str.includes(',') || str.includes('\n') || str.includes('\r')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return `"${str}"`;
}

/**
 * Generates full backup CSV text containing ALL project tasks (headings, pending, and completed)
 */
export async function generateBackupCsv(): Promise<{
  csvText: string;
  recordCount: number;
  completedCount: number;
  fileName: string;
}> {
  // 1. Fetch all tasks across the entire project (all 3,961+ rows)
  const allTasks = await fetchAllTasks(supabase);

  // 2. Fetch all progress records
  const { data: progressList, error: pErr } = await supabase
    .from('tracker_task_progress')
    .select('*');

  if (pErr) {
    throw new Error(`Failed to load progress records: ${pErr.message}`);
  }

  const progressMap = new Map<string, any>();
  for (const p of progressList || []) {
    progressMap.set(p.task_id, p);
  }

  // 3. Fetch projects to enrich with human-readable titles
  const { data: projects } = await supabase
    .from('tracker_projects')
    .select('id, title, short_title');
  const projectMap = new Map<string, string>();
  for (const p of projects || []) {
    projectMap.set(p.id, p.title || p.id);
  }

  const headers = [
    'TaskId',
    'WBS',
    'OutlineLevel',
    'IsSummary',
    'TaskName',
    'SubprojectId',
    'SubprojectName',
    'ParentTaskId',
    'SortOrder',
    'QuotedHours',
    'DurationDays',
    'Notes',
    'Status',
    'PercentComplete',
    'DoneByName',
    'TickedAt',
    'SavedAt',
  ];

  const rows: string[] = [headers.map((h) => `"${h}"`).join(',')];
  let completedCount = 0;

  for (const t of allTasks) {
    const prog = progressMap.get(t.id);
    if (prog) completedCount++;

    const subprojTitle = projectMap.get(t.project_id) || t.project_id || '';
    const isSummary = Boolean(t.is_summary);
    const status = prog ? 'Completed' : isSummary ? 'Heading' : 'Pending';
    const pct = prog ? 100 : 0;

    const row = [
      escapeCsv(t.id),
      escapeCsv(t.wbs || ''),
      escapeCsv(t.outline_level ?? 1),
      escapeCsv(isSummary ? 'Yes' : 'No'),
      escapeCsv(t.name || ''),
      escapeCsv(t.project_id || ''),
      escapeCsv(subprojTitle),
      escapeCsv(t.parent_task_id || ''),
      escapeCsv(t.sort_order ?? 0),
      escapeCsv(t.quoted_hours ? Number(t.quoted_hours) : 0),
      escapeCsv(t.duration_days ? Number(t.duration_days) : 0),
      escapeCsv(t.notes || ''),
      escapeCsv(status),
      escapeCsv(pct),
      escapeCsv(prog?.done_by_name || ''),
      escapeCsv(prog?.ticked_at || ''),
      escapeCsv(prog?.saved_at || ''),
    ];
    rows.push(row.join(','));
  }

  const now = new Date();
  const dateStamp = now.toISOString().replace(/[:.]/g, '-').substring(0, 19);
  const fileName = `protemp_full_backup_${dateStamp}.csv`;

  return {
    csvText: '\uFEFF' + rows.join('\r\n'),
    recordCount: allTasks.length,
    completedCount,
    fileName,
  };
}

/**
 * Robust RFC 4180 compliant CSV parser
 */
export function parseCsvRows(csvText: string): Array<Record<string, string>> {
  const clean = (csvText || '').replace(/^\uFEFF/, '');
  const lines: string[][] = [];
  let currentRow: string[] = [];
  let currentField = '';
  let inQuotes = false;

  for (let i = 0; i < clean.length; i++) {
    const char = clean[i];
    const nextChar = clean[i + 1];

    if (inQuotes) {
      if (char === '"' && nextChar === '"') {
        currentField += '"';
        i++; // skip escaped quote
      } else if (char === '"') {
        inQuotes = false;
      } else {
        currentField += char;
      }
    } else {
      if (char === '"') {
        inQuotes = true;
      } else if (char === ',') {
        currentRow.push(currentField.trim());
        currentField = '';
      } else if (char === '\r') {
        // ignore carriage return
      } else if (char === '\n') {
        currentRow.push(currentField.trim());
        if (currentRow.some((f) => f.length > 0)) {
          lines.push(currentRow);
        }
        currentRow = [];
        currentField = '';
      } else {
        currentField += char;
      }
    }
  }

  if (currentField.length > 0 || currentRow.length > 0) {
    currentRow.push(currentField.trim());
    if (currentRow.some((f) => f.length > 0)) {
      lines.push(currentRow);
    }
  }

  if (lines.length < 2) return [];

  // Normalize header names: lowercase and alphanumeric only
  const headers = lines[0].map((h) =>
    h
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '')
  );

  const results: Array<Record<string, string>> = [];
  for (let r = 1; r < lines.length; r++) {
    const row = lines[r];
    const obj: Record<string, string> = {};
    for (let c = 0; c < headers.length; c++) {
      obj[headers[c]] = row[c] !== undefined ? row[c] : '';
    }
    results.push(obj);
  }

  return results;
}

/**
 * Restores full project tasks and progress records from CSV into tracker_tasks & tracker_task_progress
 */
export async function restoreProgressFromCsv(csvText: string): Promise<RestoreResult> {
  const rawRows = parseCsvRows(csvText);
  if (rawRows.length === 0) {
    return {
      success: false,
      totalInFile: 0,
      tasksRestoredCount: 0,
      restoredCount: 0,
      skippedCount: 0,
      message: 'No records found in CSV file. Please verify file format.',
    };
  }

  // Pre-fetch existing tasks to validate and match task IDs
  const allTasks = await fetchAllTasks(supabase);
  const taskIdSet = new Set(allTasks.map((t) => t.id));
  const taskWbsMap = new Map<string, string>(); // wbs -> task_id
  const taskProjectMap = new Map<string, string>(); // task_id -> project_id

  for (const t of allTasks) {
    taskProjectMap.set(t.id, t.project_id);
    if (t.wbs) {
      taskWbsMap.set(t.wbs.trim(), t.id);
      taskWbsMap.set(`${t.project_id}::${t.wbs.trim()}`, t.id);
    }
  }

  // 1. Check if CSV contains full task structure rows that can be upserted into tracker_tasks
  const tasksToUpsert: Array<{
    id: string;
    project_id: string;
    parent_task_id: string | null;
    wbs: string;
    outline_level: number;
    name: string;
    is_summary: boolean;
    quoted_hours: number;
    duration_days: number;
    sort_order: number;
    notes: string;
  }> = [];

  for (let i = 0; i < rawRows.length; i++) {
    const row = rawRows[i];
    const taskId = row.taskid || row.task_id || '';
    const taskName = row.taskname || row.task_name || row.task || '';
    const projectId =
      row.subprojectid ||
      row.subproject_id ||
      row.projectid ||
      row.project_id ||
      '';

    // If this row has full task definition columns (OutlineLevel or IsSummary)
    if (taskId && taskName && projectId && ('outlinelevel' in row || 'issummary' in row)) {
      const isSummaryRaw = (row.issummary || '').toLowerCase();
      const isSummary = isSummaryRaw === 'yes' || isSummaryRaw === 'true' || isSummaryRaw === '1';

      tasksToUpsert.push({
        id: taskId,
        project_id: projectId,
        parent_task_id: row.parenttaskid ? row.parenttaskid : null,
        wbs: row.wbs || '',
        outline_level: Number(row.outlinelevel) || 1,
        name: taskName,
        is_summary: isSummary,
        quoted_hours: Number(row.quotedhours) || 0,
        duration_days: Number(row.durationdays) || 0,
        sort_order: Number(row.sortorder) || i,
        notes: row.notes || '',
      });

      taskIdSet.add(taskId);
      taskProjectMap.set(taskId, projectId);
    }
  }

  let tasksRestoredCount = 0;
  const TASK_BATCH_SIZE = 500;
  if (tasksToUpsert.length > 0) {
    for (let b = 0; b < tasksToUpsert.length; b += TASK_BATCH_SIZE) {
      const batch = tasksToUpsert.slice(b, b + TASK_BATCH_SIZE);
      const { error: taskUpsertErr } = await supabase
        .from('tracker_tasks')
        .upsert(batch, { onConflict: 'id' });

      if (taskUpsertErr) {
        console.warn(`Task structure batch notice at ${b}:`, taskUpsertErr.message);
      } else {
        tasksRestoredCount += batch.length;
      }
    }
  }

  // 2. Collect completed progress records to upsert into tracker_task_progress
  const validProgressRecords: Array<{
    task_id: string;
    project_id: string;
    done_by_name: string;
    ticked_at: string;
    saved_at: string;
  }> = [];

  const errors: string[] = [];
  let skipped = 0;

  for (let i = 0; i < rawRows.length; i++) {
    const row = rawRows[i];

    // Check if this row represents a completed stage
    const statusRaw = (row.status || '').toLowerCase();
    const pctRaw = row.percentcomplete !== undefined && row.percentcomplete !== '' ? Number(row.percentcomplete) : null;
    const doneByRaw =
      row.donebyname ||
      row.done_by_name ||
      row.doneby ||
      row.done_by ||
      row.technician ||
      row.persons ||
      '';
    const tickedAtRaw = row.tickedat || row.ticked_at || row.completeddate || row.date || '';

    // In a full 3,961-task backup, pending and heading rows have status="Pending"/"Heading" and PercentComplete=0
    const isExplicitlyUncompleted =
      statusRaw === 'pending' ||
      statusRaw === 'heading' ||
      (pctRaw !== null && pctRaw === 0 && !doneByRaw && !tickedAtRaw);

    if (isExplicitlyUncompleted) {
      continue;
    }

    // Identify task ID directly or through WBS fallback
    let resolvedTaskId = row.taskid || row.task_id || row.task || '';
    const wbs = row.wbs || '';
    const projectId =
      row.subprojectid ||
      row.subproject_id ||
      row.projectid ||
      row.project_id ||
      row.subproject ||
      '';

    if (!resolvedTaskId && wbs) {
      resolvedTaskId =
        taskWbsMap.get(`${projectId}::${wbs}`) ||
        taskWbsMap.get(wbs) ||
        '';
    }

    if (!resolvedTaskId || !taskIdSet.has(resolvedTaskId)) {
      skipped++;
      if (errors.length < 5) {
        errors.push(`Row ${i + 2}: Task ID "${resolvedTaskId || wbs}" not found in project plan.`);
      }
      continue;
    }

    const finalProjectId =
      projectId || taskProjectMap.get(resolvedTaskId) || 'avi-line-4---e-i-site-installation';
    const doneBy = doneByRaw || 'Admin Restore';

    let tickedAt = new Date().toISOString();
    if (tickedAtRaw) {
      const parsedDate = new Date(tickedAtRaw);
      if (!isNaN(parsedDate.getTime())) {
        tickedAt = parsedDate.toISOString();
      }
    }

    const rawSavedAt = row.savedat || row.saved_at;
    let savedAt = new Date().toISOString();
    if (rawSavedAt) {
      const parsedSaved = new Date(rawSavedAt);
      if (!isNaN(parsedSaved.getTime())) {
        savedAt = parsedSaved.toISOString();
      }
    }

    validProgressRecords.push({
      task_id: resolvedTaskId,
      project_id: finalProjectId,
      done_by_name: doneBy,
      ticked_at: tickedAt,
      saved_at: savedAt,
    });
  }

  if (validProgressRecords.length === 0 && tasksRestoredCount === 0) {
    return {
      success: false,
      totalInFile: rawRows.length,
      tasksRestoredCount: 0,
      restoredCount: 0,
      skippedCount: skipped,
      errors,
      message: 'No matching tasks or completed progress records could be resolved from CSV.',
    };
  }

  // Upsert completed progress in batches of 250
  const BATCH_SIZE = 250;
  let restored = 0;

  for (let b = 0; b < validProgressRecords.length; b += BATCH_SIZE) {
    const batch = validProgressRecords.slice(b, b + BATCH_SIZE);
    const { error: upsertErr } = await supabase
      .from('tracker_task_progress')
      .upsert(batch, { onConflict: 'task_id' });

    if (upsertErr) {
      throw new Error(`Batch upsert error at record ${b}: ${upsertErr.message}`);
    }
    restored += batch.length;
  }

  const parts: string[] = [];
  if (tasksRestoredCount > 0) {
    parts.push(`${tasksRestoredCount.toLocaleString()} project tasks`);
  }
  parts.push(`${restored.toLocaleString()} completed progress records`);

  return {
    success: true,
    totalInFile: rawRows.length,
    tasksRestoredCount,
    restoredCount: restored,
    skippedCount: skipped,
    errors: errors.length > 0 ? errors : undefined,
    message: `Successfully restored ${parts.join(' and ')}${skipped > 0 ? ` (${skipped} skipped)` : ''}.`,
  };
}
