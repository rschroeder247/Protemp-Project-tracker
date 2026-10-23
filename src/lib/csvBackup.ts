import { supabase, fetchAllTasks } from './supabase';

export interface BackupProgressRecord {
  taskId: string;
  wbs: string;
  taskName: string;
  subprojectId: string;
  subprojectName: string;
  doneByName: string;
  tickedAt: string;
  savedAt: string;
  quotedHours: number;
  percentComplete: number;
}

export interface RestoreResult {
  success: boolean;
  totalInFile: number;
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
 * Generates full backup CSV text containing all completed progress records
 */
export async function generateBackupCsv(): Promise<{
  csvText: string;
  recordCount: number;
  fileName: string;
}> {
  // 1. Fetch all progress records
  const { data: progressList, error: pErr } = await supabase
    .from('tracker_task_progress')
    .select('*')
    .order('ticked_at', { ascending: false });

  if (pErr) {
    throw new Error(`Failed to load progress records: ${pErr.message}`);
  }

  // 2. Fetch all tasks to enrich with WBS, TaskName, QuotedHours
  const allTasks = await fetchAllTasks(supabase);
  const taskMap = new Map<string, any>();
  for (const t of allTasks) {
    taskMap.set(t.id, t);
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
    'TaskName',
    'SubprojectId',
    'SubprojectName',
    'DoneByName',
    'TickedAt',
    'SavedAt',
    'QuotedHours',
    'PercentComplete',
  ];

  const rows: string[] = [headers.map((h) => `"${h}"`).join(',')];

  for (const p of progressList || []) {
    const task = taskMap.get(p.task_id);
    const subprojTitle = projectMap.get(p.project_id) || p.project_id || '';

    const row = [
      escapeCsv(p.task_id),
      escapeCsv(task?.wbs || ''),
      escapeCsv(task?.name || ''),
      escapeCsv(p.project_id || task?.project_id || ''),
      escapeCsv(subprojTitle),
      escapeCsv(p.done_by_name || ''),
      escapeCsv(p.ticked_at || ''),
      escapeCsv(p.saved_at || ''),
      escapeCsv(task?.quoted_hours ? Number(task.quoted_hours) : 0),
      escapeCsv(100),
    ];
    rows.push(row.join(','));
  }

  const now = new Date();
  const dateStamp = now.toISOString().replace(/[:.]/g, '-').substring(0, 19);
  const fileName = `protemp_backup_${dateStamp}.csv`;

  return {
    csvText: '\uFEFF' + rows.join('\r\n'),
    recordCount: progressList ? progressList.length : 0,
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
 * Restores progress records from CSV into tracker_task_progress
 */
export async function restoreProgressFromCsv(csvText: string): Promise<RestoreResult> {
  const rawRows = parseCsvRows(csvText);
  if (rawRows.length === 0) {
    return {
      success: false,
      totalInFile: 0,
      restoredCount: 0,
      skippedCount: 0,
      message: 'No progress records found in CSV file. Please verify file format.',
    };
  }

  // Pre-fetch tasks to validate and match task IDs
  const allTasks = await fetchAllTasks(supabase);
  const taskIdSet = new Set(allTasks.map((t) => t.id));
  const taskWbsMap = new Map<string, string>(); // wbs -> task_id
  const taskProjectMap = new Map<string, string>(); // task_id -> project_id

  for (const t of allTasks) {
    taskProjectMap.set(t.id, t.project_id);
    if (t.wbs) {
      taskWbsMap.set(t.wbs.trim(), t.id);
      // also composite key: project_id + '::' + wbs
      taskWbsMap.set(`${t.project_id}::${t.wbs.trim()}`, t.id);
    }
  }

  const validRecords: Array<{
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

    // Identify task ID directly or through WBS fallback
    let resolvedTaskId =
      row.taskid ||
      row.task_id ||
      row.task ||
      '';

    const wbs = row.wbs || '';
    const projectId =
      row.subprojectid ||
      row.subproject_id ||
      row.projectid ||
      row.project_id ||
      row.subproject ||
      '';

    if (!resolvedTaskId && wbs) {
      // Lookup by project + wbs, then by wbs alone
      resolvedTaskId =
        taskWbsMap.get(`${projectId}::${wbs}`) ||
        taskWbsMap.get(wbs) ||
        '';
    }

    if (!resolvedTaskId || !taskIdSet.has(resolvedTaskId)) {
      skipped++;
      if (errors.length < 5) {
        errors.push(`Row ${i + 2}: Task ID "${resolvedTaskId || wbs}" not found in current project plan.`);
      }
      continue;
    }

    const finalProjectId = projectId || taskProjectMap.get(resolvedTaskId) || 'avi-line-4---e-i-site-installation';
    const doneBy =
      row.donebyname ||
      row.done_by_name ||
      row.doneby ||
      row.done_by ||
      row.technician ||
      row.persons ||
      'Admin Restore';

    const rawTickedAt = row.tickedat || row.ticked_at || row.completeddate || row.date;
    let tickedAt = new Date().toISOString();
    if (rawTickedAt) {
      const parsedDate = new Date(rawTickedAt);
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

    validRecords.push({
      task_id: resolvedTaskId,
      project_id: finalProjectId,
      done_by_name: doneBy,
      ticked_at: tickedAt,
      saved_at: savedAt,
    });
  }

  if (validRecords.length === 0) {
    return {
      success: false,
      totalInFile: rawRows.length,
      restoredCount: 0,
      skippedCount: skipped,
      errors,
      message: 'No matching tasks could be resolved from CSV to restore.',
    };
  }

  // Upsert in batches of 250 to avoid request size limits
  const BATCH_SIZE = 250;
  let restored = 0;

  for (let b = 0; b < validRecords.length; b += BATCH_SIZE) {
    const batch = validRecords.slice(b, b + BATCH_SIZE);
    const { error: upsertErr } = await supabase
      .from('tracker_task_progress')
      .upsert(batch, { onConflict: 'task_id' });

    if (upsertErr) {
      throw new Error(`Batch upsert error at record ${b}: ${upsertErr.message}`);
    }
    restored += batch.length;
  }

  return {
    success: true,
    totalInFile: rawRows.length,
    restoredCount: restored,
    skippedCount: skipped,
    errors: errors.length > 0 ? errors : undefined,
    message: `Successfully restored ${restored} progress records${skipped > 0 ? ` (${skipped} skipped/unmatched)` : ''}.`,
  };
}
