import crypto from 'node:crypto';
import { UserRole } from './types';

export interface AuthSession {
  role: UserRole;
  name: string;
  teamId?: string;
  teamName?: string;
  createdAt: number;
  expiresAt: number;
}

export interface TeamDefinition {
  id: string; // 'team_1', 'team_2', etc.
  name: string; // 'Team 1', 'Team 2', etc.
  pin: string; // '1001', '1002', etc.
  password: string; // 'team1', 'team2', etc.
  role: UserRole;
}

// 10 Distinct Teams with dedicated PINs (1001-1010) and passwords (team1-team10)
export const TEAMS: TeamDefinition[] = Array.from({ length: 10 }, (_, i) => {
  const num = i + 1;
  const defaultPin = String(1000 + num);
  const defaultPass = `team${num}`;
  return {
    id: `team_${num}`,
    name: `Team ${num}`,
    pin: (process.env[`TEAM_${num}_PIN`] || defaultPin).trim(),
    password: (process.env[`TEAM_${num}_PASSWORD`] || defaultPass).trim(),
    role: 'contractor' as UserRole,
  };
});

const DEFAULT_AUTH_SECRET = 'protemp_secure_auth_secret_jwt_2026_x7a9k';
const SESSION_COOKIE_NAME = 'protemp_session';
const SESSION_DURATION_MS = 60 * 24 * 60 * 60 * 1000; // 60 days

/**
 * Validates a PIN or password and returns the matched role and team details.
 */
export function verifyCredentials(input: string): {
  valid: boolean;
  role?: UserRole;
  teamId?: string;
  teamName?: string;
  error?: string;
} {
  const cleanInput = (input || '').trim();
  const lowerInput = cleanInput.toLowerCase();
  if (!cleanInput) {
    return { valid: false, error: 'Please enter a PIN or password' };
  }

  const adminPassword = (process.env.ADMIN_PASSWORD || 'protemp2026').trim().toLowerCase();
  const ownerPin = (process.env.OWNER_PIN || '9824').trim();
  const staffPin = (process.env.STAFF_PIN || '2470').trim();
  const staffPassword = (process.env.STAFF_PASSWORD || 'staff').trim().toLowerCase();
  const guestPin = (process.env.GUEST_PIN || process.env.CONTRACTOR_PIN || '1122').trim();
  const guestPassword = (process.env.GUEST_PASSWORD || 'guest').trim().toLowerCase();

  // 1. Check Admin / Owner
  if (lowerInput === adminPassword || cleanInput === ownerPin) {
    return { valid: true, role: 'owner', teamName: 'Roland (Admin)' };
  }

  // 2. Check 10 Teams (e.g. PIN 1001 or password "team1" for Team 1)
  for (const team of TEAMS) {
    if (cleanInput === team.pin || lowerInput === team.password.toLowerCase()) {
      return {
        valid: true,
        role: team.role,
        teamId: team.id,
        teamName: team.name,
      };
    }
  }

  // 3. Check Staff
  if (cleanInput === staffPin || lowerInput === staffPassword) {
    return { valid: true, role: 'staff', teamName: 'Staff Member' };
  }

  // 4. Check Guest
  if (cleanInput === guestPin || lowerInput === guestPassword) {
    return { valid: true, role: 'viewer', teamId: 'guest', teamName: 'Guest' };
  }

  return { valid: false, error: 'Incorrect PIN or password. Please try again.' };
}

/**
 * Creates an HMAC signed session token string.
 */
export function createSessionToken(session: AuthSession): string {
  const secret = process.env.AUTH_SECRET || DEFAULT_AUTH_SECRET;
  const payload = Buffer.from(JSON.stringify(session)).toString('base64url');
  const signature = crypto
    .createHmac('sha256', secret)
    .update(payload)
    .digest('base64url');

  return `${payload}.${signature}`;
}

/**
 * Verifies and decodes an HMAC signed session token.
 */
export function verifySessionToken(token: string): AuthSession | null {
  if (!token || !token.includes('.')) return null;

  try {
    const [payload, signature] = token.split('.');
    const secret = process.env.AUTH_SECRET || DEFAULT_AUTH_SECRET;
    const expectedSignature = crypto
      .createHmac('sha256', secret)
      .update(payload)
      .digest('base64url');

    if (signature !== expectedSignature) {
      return null;
    }

    const sessionJson = Buffer.from(payload, 'base64url').toString('utf8');
    const session: AuthSession = JSON.parse(sessionJson);

    // Check expiration
    if (Date.now() > session.expiresAt) {
      return null;
    }

    return session;
  } catch (err) {
    return null;
  }
}

/**
 * Parses the session cookie from request cookies header.
 */
export function getSessionFromCookies(cookieHeader: string | null): AuthSession | null {
  if (!cookieHeader) return null;

  const match = cookieHeader.match(new RegExp(`(?:^|;\\s*)${SESSION_COOKIE_NAME}=([^;]*)`));
  if (!match || !match[1]) return null;

  return verifySessionToken(decodeURIComponent(match[1]));
}

/**
 * Verifies whether an API request is authorized via session cookie or API key.
 */
export function isAuthorizedApiRequest(req: {
  headers: { get: (name: string) => string | null };
  nextUrl?: { searchParams: { get: (name: string) => string | null } };
  url?: string;
}): boolean {
  const cookieHeader = req.headers.get('cookie');
  const session = getSessionFromCookies(cookieHeader);
  if (session) return true;

  const apiKeyHeader = req.headers.get('x-api-key');
  let apiKeyParam: string | null = null;
  if (req.nextUrl) {
    apiKeyParam = req.nextUrl.searchParams.get('apiKey');
  } else if (req.url) {
    try {
      const url = new URL(req.url);
      apiKeyParam = url.searchParams.get('apiKey');
    } catch {}
  }

  const passedKey = apiKeyHeader || apiKeyParam;
  const expectedKey = process.env.SYNC_API_KEY || 'pt_sync_sec_2026_9824';

  return !!passedKey && passedKey === expectedKey;
}

export { SESSION_COOKIE_NAME, SESSION_DURATION_MS };
