import { NextRequest, NextResponse } from 'next/server';
import { syncProjectTreeToSupabase } from '@/lib/msproject';
import { parseMsProjectXml } from '@/lib/msproject-xml';

export async function POST(req: NextRequest) {
  try {
    const contentType = req.headers.get('content-type') || '';
    let projectName = 'Master Project';
    let tasks: any[] = [];

    if (contentType.includes('application/json')) {
      const body = await req.json();
      projectName = body.projectName || 'Master Project';
      tasks = body.tasks || [];
    } else if (contentType.includes('text/xml') || contentType.includes('application/xml')) {
      const xmlText = await req.text();
      const parsed = parseMsProjectXml(xmlText);
      projectName = parsed.projectName;
      tasks = parsed.tasks;
    } else {
      // Try text or form-data
      const rawText = await req.text();
      if (rawText.trim().startsWith('<')) {
        const parsed = parseMsProjectXml(rawText);
        projectName = parsed.projectName;
        tasks = parsed.tasks;
      } else {
        const body = JSON.parse(rawText);
        projectName = body.projectName || 'Master Project';
        tasks = body.tasks || [];
      }
    }

    if (!tasks || !Array.isArray(tasks) || tasks.length === 0) {
      return NextResponse.json(
        { error: 'No tasks found in project data' },
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
      projectName,
      tasks
    );

    return NextResponse.json({
      success: true,
      projectName,
      count: result.count,
    });
  } catch (error: any) {
    console.error('Sync error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
