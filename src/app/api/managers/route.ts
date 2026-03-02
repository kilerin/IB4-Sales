import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const uploadId = searchParams.get('uploadId');
  if (!uploadId) {
    return NextResponse.json({ error: 'uploadId required' }, { status: 400 });
  }

  try {
    const rows = await query<{ manager: string }>(
      "SELECT DISTINCT COALESCE(manager, 'Unassigned') AS manager FROM deals WHERE upload_id = $1 ORDER BY manager",
      [uploadId]
    );
    const managers = rows.map((r) => r.manager);
    return NextResponse.json(managers);
  } catch (e) {
    console.error('Managers list error:', e);
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
