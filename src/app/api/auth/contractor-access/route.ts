import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromCookies } from '@/lib/auth';
import { supabase } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const { data, error } = await supabase
      .from('tracker_app_settings')
      .select('value')
      .eq('key', 'contractor_allowed_subprojects')
      .single();

    const allowed = data && Array.isArray(data.value) ? data.value : [];
    return NextResponse.json({ allowedSubprojects: allowed });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    // Only Admin can configure contractor access
    const session = getSessionFromCookies(req.headers.get('cookie'));
    if (!session || session.role !== 'owner') {
      return NextResponse.json(
        { error: 'Unauthorized: Only Admin can configure contractor permissions' },
        { status: 403 }
      );
    }

    const body = await req.json();
    const allowedSubprojects: string[] = Array.isArray(body.allowedSubprojects)
      ? body.allowedSubprojects
      : [];

    // Save to settings table
    const { error: upsertErr } = await supabase.from('tracker_app_settings').upsert({
      key: 'contractor_allowed_subprojects',
      value: allowedSubprojects,
      updated_at: new Date().toISOString(),
    });

    if (upsertErr) {
      throw upsertErr;
    }

    // Also update contractor_accessible flags in tracker_projects
    await supabase
      .from('tracker_projects')
      .update({ contractor_accessible: false })
      .neq('id', 'dummy_never_match');

    if (allowedSubprojects.length > 0) {
      await supabase
        .from('tracker_projects')
        .update({ contractor_accessible: true })
        .in('id', allowedSubprojects);
    }

    return NextResponse.json({ success: true, allowedSubprojects });
  } catch (err: any) {
    console.error('Save contractor access error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
