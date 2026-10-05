import { NextRequest, NextResponse } from 'next/server';
import {
  verifyCredentials,
  createSessionToken,
  SESSION_COOKIE_NAME,
  SESSION_DURATION_MS,
  AuthSession,
} from '@/lib/auth';
import { supabase } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const pin = body.pin || '';
    const technicianName = (body.technicianName || '').trim();

    const verification = verifyCredentials(pin);
    if (!verification.valid || !verification.role) {
      return NextResponse.json(
        { error: verification.error || 'Invalid PIN or password' },
        { status: 401 }
      );
    }

    const role = verification.role;

    // Determine default display name if not provided
    let displayName = technicianName;
    if (!displayName) {
      if (role === 'owner') displayName = 'Roland (Admin)';
      else if (role === 'staff') displayName = 'Staff Member';
      else displayName = 'Contractor Team';
    }

    const now = Date.now();
    const session: AuthSession = {
      role,
      name: displayName,
      createdAt: now,
      expiresAt: now + SESSION_DURATION_MS,
    };

    const token = createSessionToken(session);

    // If contractor, fetch allowed subprojects
    let allowedSubprojects: string[] = [];
    if (role === 'contractor') {
      const { data } = await supabase
        .from('tracker_app_settings')
        .select('value')
        .eq('key', 'contractor_allowed_subprojects')
        .single();

      if (data && Array.isArray(data.value)) {
        allowedSubprojects = data.value;
      }
    }

    const response = NextResponse.json({
      success: true,
      role,
      name: displayName,
      allowedSubprojects,
      token,
    });

    // Set HTTP-only secure cookie for persistent 60-day session
    response.cookies.set({
      name: SESSION_COOKIE_NAME,
      value: token,
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: Math.floor(SESSION_DURATION_MS / 1000),
    });

    return response;
  } catch (err: any) {
    console.error('Login error:', err);
    return NextResponse.json({ error: err.message || 'Login failed' }, { status: 500 });
  }
}
