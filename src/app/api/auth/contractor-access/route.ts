import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromCookies } from '@/lib/auth';
import { supabase } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const { data: teamData } = await supabase
      .from('tracker_app_settings')
      .select('value')
      .eq('key', 'team_allowed_subprojects')
      .maybeSingle();

    const { data: globalData } = await supabase
      .from('tracker_app_settings')
      .select('value')
      .eq('key', 'contractor_allowed_subprojects')
      .maybeSingle();

    const teamAllowedSubprojects: Record<string, string[]> =
      teamData?.value && typeof teamData.value === 'object' && !Array.isArray(teamData.value)
        ? (teamData.value as Record<string, string[]>)
        : {};

    const allowedSubprojects: string[] =
      globalData?.value && Array.isArray(globalData.value) ? globalData.value : [];

    return NextResponse.json({
      teamAllowedSubprojects,
      allowedSubprojects,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    // Only Admin can configure team project allocations
    const session = getSessionFromCookies(req.headers.get('cookie'));
    if (!session || session.role !== 'owner') {
      return NextResponse.json(
        { error: 'Unauthorized: Only Admin can configure team project allocations' },
        { status: 403 }
      );
    }

    const body = await req.json();
    const teamAllowedSubprojects: Record<string, string[]> =
      body.teamAllowedSubprojects && typeof body.teamAllowedSubprojects === 'object'
        ? body.teamAllowedSubprojects
        : {};

    const allowedSubprojects: string[] = Array.isArray(body.allowedSubprojects)
      ? body.allowedSubprojects
      : [];

    const now = new Date().toISOString();

    // 1. Save per-team allocations
    const { error: teamErr } = await supabase.from('tracker_app_settings').upsert({
      key: 'team_allowed_subprojects',
      value: teamAllowedSubprojects,
      updated_at: now,
    });
    if (teamErr) throw teamErr;

    // 2. Save global contractor fallback
    const { error: globalErr } = await supabase.from('tracker_app_settings').upsert({
      key: 'contractor_allowed_subprojects',
      value: allowedSubprojects,
      updated_at: now,
    });
    if (globalErr) throw globalErr;

    // 3. Update contractor_accessible flags in tracker_projects
    await supabase
      .from('tracker_projects')
      .update({ contractor_accessible: false })
      .neq('id', 'dummy_never_match');

    // Collect all unique allowed project / subproject IDs across all teams
    const allAllowedUnique = new Set<string>(allowedSubprojects);
    for (const teamSubprojs of Object.values(teamAllowedSubprojects)) {
      if (Array.isArray(teamSubprojs)) {
        for (const sp of teamSubprojs) {
          if (sp && sp !== '__NONE__' && sp !== '__ALL__') {
            allAllowedUnique.add(sp);
          }
        }
      }
    }

    if (allAllowedUnique.size > 0) {
      await supabase
        .from('tracker_projects')
        .update({ contractor_accessible: true })
        .in('id', Array.from(allAllowedUnique));
    }

    return NextResponse.json({
      success: true,
      teamAllowedSubprojects,
      allowedSubprojects,
    });
  } catch (err: any) {
    console.error('Save team project access error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
