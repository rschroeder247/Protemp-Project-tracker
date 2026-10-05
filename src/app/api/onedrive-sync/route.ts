import { NextRequest, NextResponse } from 'next/server';
import { downloadFileFromOneDrive } from '@/lib/ms-graph';
import { parseMsProjectXml } from '@/lib/msproject-xml';
import { syncProjectTreeToSupabase } from '@/lib/msproject';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    let fileName = 'Master Project.xml';

    try {
      const body = await req.json();
      if (body.fileName) fileName = body.fileName;
    } catch {
      // Use default
    }

    // 1. Fetch file directly from OneDrive in the cloud
    const { content, webUrl } = await downloadFileFromOneDrive(fileName);

    // 2. Parse MS Project XML
    const parsed = parseMsProjectXml(content);

    if (!parsed.tasks || parsed.tasks.length === 0) {
      return NextResponse.json(
        { error: 'No tasks found in project XML from OneDrive' },
        { status: 400 }
      );
    }

    const supabaseUrl =
      process.env.NEXT_PUBLIC_SUPABASE_URL ||
      'https://dphxaglpramhwcwcnpay.supabase.co';

    const supabaseKey =
      process.env.SUPABASE_SERVICE_ROLE_KEY ||
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
      'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRwaHhhZ2xwcmFtaHdjd2NucGF5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMyNDg4NzksImV4cCI6MjA4ODgyNDg3OX0.Z2uLJlqYfs6RGcrRe3SpyaHo7BzvO4QgmYp9lXVEKN0';

    const result = await syncProjectTreeToSupabase(
      supabaseUrl,
      supabaseKey,
      parsed.projectName,
      parsed.tasks
    );

    return NextResponse.json({
      success: true,
      fileName,
      projectName: parsed.projectName,
      taskCount: result.count,
      webUrl,
    });
  } catch (error: any) {
    console.error('OneDrive sync error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  return POST(req);
}

