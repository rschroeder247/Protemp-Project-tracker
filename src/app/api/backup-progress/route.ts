import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromCookies } from '@/lib/auth';
import { generateBackupCsv, restoreProgressFromCsv } from '@/lib/csvBackup';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/**
 * GET: Export full CSV backup (Admin only)
 */
export async function GET(req: NextRequest) {
  try {
    const session = getSessionFromCookies(req.headers.get('cookie'));
    if (!session || session.role !== 'owner') {
      return NextResponse.json(
        { error: 'Unauthorized: Only Admin can download progress backup' },
        { status: 403 }
      );
    }

    const { csvText, fileName } = await generateBackupCsv();

    return new NextResponse(csvText, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${fileName}"`,
        'Cache-Control': 'no-store, no-cache, must-revalidate',
      },
    });
  } catch (error: any) {
    console.error('Backup download error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

/**
 * POST: Restore progress from uploaded CSV (Admin only)
 */
export async function POST(req: NextRequest) {
  try {
    const session = getSessionFromCookies(req.headers.get('cookie'));
    if (!session || session.role !== 'owner') {
      return NextResponse.json(
        { error: 'Unauthorized: Only Admin can restore progress from backup' },
        { status: 403 }
      );
    }

    let csvText = '';

    const contentType = req.headers.get('content-type') || '';
    if (contentType.includes('multipart/form-data')) {
      const formData = await req.formData();
      const file = formData.get('file');
      if (!file || typeof file === 'string') {
        return NextResponse.json(
          { error: 'No CSV file provided in upload request' },
          { status: 400 }
        );
      }
      csvText = await (file as Blob).text();
    } else {
      const body = await req.json();
      csvText = body.csvText || '';
    }

    if (!csvText.trim()) {
      return NextResponse.json(
        { error: 'The uploaded CSV file is empty' },
        { status: 400 }
      );
    }

    const result = await restoreProgressFromCsv(csvText);

    if (!result.success) {
      return NextResponse.json(result, { status: 400 });
    }

    return NextResponse.json(result);
  } catch (error: any) {
    console.error('Restore error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
