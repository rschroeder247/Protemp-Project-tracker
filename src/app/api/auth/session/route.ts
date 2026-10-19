import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromCookies, verifySessionToken } from '@/lib/auth';
import { supabase } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const cookieHeader = req.headers.get('cookie');
    let session = getSessionFromCookies(cookieHeader);

    // Also check Authorization header as fallback
    if (!session) {
      const authHeader = req.headers.get('authorization');
      if (authHeader && authHeader.startsWith('Bearer ')) {
        session = verifySessionToken(authHeader.substring(7));
      }
    }

    if (!session) {
      return NextResponse.json({ authenticated: false });
    }

    let allowedSubprojects: string[] = [];
    if (session.role === 'contractor' || session.role === 'viewer') {
      const { data: teamSetting } = await supabase
        .from('tracker_app_settings')
        .select('value')
        .eq('key', 'team_allowed_subprojects')
        .maybeSingle();

      const teamMap =
        teamSetting?.value &&
        typeof teamSetting.value === 'object' &&
        !Array.isArray(teamSetting.value)
          ? (teamSetting.value as Record<string, string[]>)
          : null;

      const teamKey = session.teamId || 'guest';
      if (teamMap && teamKey in teamMap) {
        const teamAlloc = teamMap[teamKey];
        if (Array.isArray(teamAlloc)) {
          allowedSubprojects = teamAlloc.length === 0 ? ['__NONE__'] : teamAlloc;
        }
      } else {
        // Fallback to global contractor setting
        const { data: globalSetting } = await supabase
          .from('tracker_app_settings')
          .select('value')
          .eq('key', 'contractor_allowed_subprojects')
          .maybeSingle();

        if (globalSetting && Array.isArray(globalSetting.value)) {
          allowedSubprojects = globalSetting.value;
        }
      }
    }

    return NextResponse.json({
      authenticated: true,
      role: session.role,
      name: session.name,
      teamId: session.teamId,
      teamName: session.teamName,
      allowedSubprojects,
    });
  } catch (err: any) {
    return NextResponse.json({ authenticated: false, error: err.message }, { status: 500 });
  }
}
