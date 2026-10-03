import { NextRequest, NextResponse } from 'next/server';
import { syncProjectTreeToSupabase } from '@/lib/msproject';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { projectName = 'Master Project', tasks } = body;

    if (!tasks || !Array.isArray(tasks)) {
      return NextResponse.json(
        { error: 'Missing tasks array in request body' },
        { status: 400 }
      );
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
    const supabaseKey =
      process.env.SUPABASE_SERVICE_ROLE_KEY ||
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
      '';

    const result = await syncProjectTreeToSupabase(
      supabaseUrl,
      supabaseKey,
      projectName,
      tasks
    );

    return NextResponse.json({ success: true, count: result.count });
  } catch (error: any) {
    console.error('Sync error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
