import { NextRequest, NextResponse } from 'next/server';
import {
  getOneDriveFileMetadata,
  downloadFileContentByItem,
  downloadFileFromOneDrive,
} from '@/lib/ms-graph';
import { parseMsProjectXml } from '@/lib/msproject-xml';
import { syncProjectTreeToSupabase } from '@/lib/msproject';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  try {
    let fileName = 'Master Project.xml';
    let force = false;

    try {
      const body = await req.json();
      if (body.fileName) fileName = body.fileName;
      if (body.force) force = Boolean(body.force);
    } catch {
      // Use defaults
    }

    const { searchParams } = new URL(req.url);
    if (searchParams.get('force') === 'true') {
      force = true;
    }

    const supabaseUrl =
      process.env.NEXT_PUBLIC_SUPABASE_URL ||
      'https://dphxaglpramhwcwcnpay.supabase.co';

    const supabaseKey =
      process.env.SUPABASE_SERVICE_ROLE_KEY ||
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
      'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRwaHhhZ2xwcmFtaHdjd2NucGF5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMyNDg4NzksImV4cCI6MjA4ODgyNDg3OX0.Z2uLJlqYfs6RGcrRe3SpyaHo7BzvO4QgmYp9lXVEKN0';

    const supabase = createClient(supabaseUrl, supabaseKey);

    // 1. OPTION 1: Ultra-fast metadata check (~200ms) to detect if file changed
    const meta = await getOneDriveFileMetadata(fileName);

    if (meta && !force) {
      const { data: settingRow } = await supabase
        .from('tracker_app_settings')
        .select('value')
        .eq('key', 'onedrive_sync_metadata')
        .maybeSingle();

      const saved = settingRow?.value;
      if (
        saved &&
        saved.fileName === fileName &&
        saved.lastModifiedDateTime === meta.lastModifiedDateTime &&
        saved.eTag === meta.eTag
      ) {
        // File has NOT changed since last sync: skip download & DB write!
        return NextResponse.json({
          success: true,
          unchanged: true,
          message: 'Project is already up to date with OneDrive',
          fileName,
          taskCount: saved.taskCount || 3466,
          webUrl: meta.webUrl,
          lastModifiedDateTime: meta.lastModifiedDateTime,
        });
      }
    }

    // 2. Fetch content: use direct item download if metadata exists, else fallback
    let content = '';
    let webUrl = meta?.webUrl;
    let lastModifiedDateTime = meta?.lastModifiedDateTime;

    if (meta) {
      content = await downloadFileContentByItem(meta.driveId, meta.id);
    } else {
      const fallback = await downloadFileFromOneDrive(fileName);
      content = fallback.content;
      webUrl = fallback.webUrl;
      lastModifiedDateTime = fallback.lastModifiedDateTime;
    }

    // 3. Parse MS Project XML
    const parsed = parseMsProjectXml(content);

    if (!parsed.tasks || parsed.tasks.length === 0) {
      return NextResponse.json(
        { error: 'No tasks found in project XML from OneDrive' },
        { status: 400 }
      );
    }

    // 4. Batch sync to Supabase (with parallel chunks & pruning safeguard)
    const result = await syncProjectTreeToSupabase(
      supabaseUrl,
      supabaseKey,
      parsed.projectName,
      parsed.tasks
    );

    // 5. Record latest sync metadata in tracker_app_settings
    if (meta || lastModifiedDateTime) {
      await supabase.from('tracker_app_settings').upsert({
        key: 'onedrive_sync_metadata',
        value: {
          fileName,
          eTag: meta?.eTag || '',
          lastModifiedDateTime: meta?.lastModifiedDateTime || lastModifiedDateTime,
          taskCount: result.count,
          lastSyncedAt: new Date().toISOString(),
        },
        updated_at: new Date().toISOString(),
      });
    }

    return NextResponse.json({
      success: true,
      unchanged: false,
      fileName,
      projectName: parsed.projectName,
      taskCount: result.count,
      webUrl,
      lastModifiedDateTime,
    });
  } catch (error: any) {
    console.error('OneDrive sync error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  return POST(req);
}
