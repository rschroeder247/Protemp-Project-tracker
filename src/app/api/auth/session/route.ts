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
    if (session.role === 'contractor') {
      const { data } = await supabase
        .from('tracker_app_settings')
        .select('value')
        .eq('key', 'contractor_allowed_subprojects')
        .single();

      if (data && Array.isArray(data.value)) {
        allowedSubprojects = data.value;
      }
    }

    return NextResponse.json({
      authenticated: true,
      role: session.role,
      name: session.name,
      allowedSubprojects,
    });
  } catch (err: any) {
    return NextResponse.json({ authenticated: false, error: err.message }, { status: 500 });
  }
}
