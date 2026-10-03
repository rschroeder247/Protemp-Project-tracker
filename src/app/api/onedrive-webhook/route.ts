import { NextRequest, NextResponse } from 'next/server';
import { downloadFileFromOneDrive } from '@/lib/ms-graph';
import { parseMsProjectXml } from '@/lib/msproject-xml';
import { syncProjectTreeToSupabase } from '@/lib/msproject';

export const dynamic = 'force-dynamic';

/**
 * Microsoft Graph Webhook Handler
 * 1. Handles validation token challenge on subscription setup
 * 2. Processes change notifications when files in OneDrive are updated
 */
export async function POST(req: NextRequest) {
  // Check for Microsoft Graph validation token query param
  const { searchParams } = new URL(req.url);
  const validationToken = searchParams.get('validationToken');

  if (validationToken) {
    return new NextResponse(validationToken, {
      status: 200,
      headers: { 'Content-Type': 'text/plain' },
    });
  }

  try {
    const body = await req.json();

    // Trigger auto-sync in background
    if (body.value && Array.isArray(body.value)) {
      const { content } = await downloadFileFromOneDrive('Master Project.xml');
      const parsed = parseMsProjectXml(content);

      if (parsed.tasks && parsed.tasks.length > 0) {
        const supabaseUrl =
          process.env.NEXT_PUBLIC_SUPABASE_URL ||
          'https://dphxaglpramhwcwcnpay.supabase.co';

        const supabaseKey =
          process.env.SUPABASE_SERVICE_ROLE_KEY ||
          process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
          '';

        await syncProjectTreeToSupabase(
          supabaseUrl,
          supabaseKey,
          parsed.projectName,
          parsed.tasks
        );
      }
    }

    return new NextResponse('OK', { status: 200 });
  } catch (error: any) {
    console.error('Webhook error:', error);
    return new NextResponse('Internal Error', { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const validationToken = searchParams.get('validationToken');

  if (validationToken) {
    return new NextResponse(validationToken, {
      status: 200,
      headers: { 'Content-Type': 'text/plain' },
    });
  }

  return new NextResponse('Microsoft Graph Webhook Endpoint Active', { status: 200 });
}
