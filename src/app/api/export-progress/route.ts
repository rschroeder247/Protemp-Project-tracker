import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const format = searchParams.get('format') || 'json';

    // Query all completed/locked progress joined with tasks (selecting only needed columns)
    const { data: progressRows, error: pErr } = await supabase
      .from('tracker_task_progress')
      .select('task_id, project_id, done_by_name, ticked_at, saved_at, tracker_tasks(name, wbs, quoted_hours)');

    if (pErr) {
      return NextResponse.json({ error: pErr.message }, { status: 500 });
    }

    const items = (progressRows || []).map((row: any) => {
      const task = Array.isArray(row.tracker_tasks) ? row.tracker_tasks[0] : row.tracker_tasks;
      return {
        taskId: row.task_id,
        wbs: task?.wbs || '',
        taskName: task?.name || '',
        subproject: row.project_id || task?.project_id || '',
        percentComplete: 100,
        quotedHours: Number(task?.quoted_hours) || 0,
        doneByName: row.done_by_name || '',
        tickedAt: row.ticked_at || '',
        savedAt: row.saved_at || '',
      };
    });

    if (format === 'csv') {
      const headers = 'WBS,Task,Subproject,PercentComplete,QuotedHours,DoneBy,CompletedDate\n';
      const csvLines = items
        .map(
          (i) =>
            `"${i.wbs}","${i.taskName.replace(/"/g, '""')}","${i.subproject}",100,${i.quotedHours},"${i.doneByName}","${i.tickedAt}"`
        )
        .join('\n');
      return new NextResponse('\uFEFF' + headers + csvLines, {
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': 'attachment; filename="site_progress_export.csv"',
        },
      });
    }

    return NextResponse.json({
      success: true,
      count: items.length,
      progress: items,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
