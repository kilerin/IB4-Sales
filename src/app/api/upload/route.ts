import { NextRequest, NextResponse } from 'next/server';
import { parseExcel, joinDealsWithManagers } from '@/lib/parse-excel';
import { query } from '@/lib/db';
import { writeFile, mkdir } from 'fs/promises';
import path from 'path';

const UPLOAD_DIR = process.env.UPLOAD_DIR || path.join(process.cwd(), 'uploads');

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }
    const arrayBuffer = await file.arrayBuffer();
    const { deals, clients, closedSetsCount } = parseExcel(arrayBuffer);
    const buffer = Buffer.from(arrayBuffer);

    await mkdir(UPLOAD_DIR, { recursive: true });
    const filename = `${Date.now()}_${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
    const filepath = path.join(UPLOAD_DIR, filename);
    await writeFile(filepath, buffer);

    const rows = await query<{ id: number }>(
      'INSERT INTO uploads (filename, file_size, closed_sets_count) VALUES ($1, $2, $3) RETURNING id',
      [file.name, buffer.length, closedSetsCount]
    );
    const uploadId = rows[0]?.id;
    if (!uploadId) throw new Error('Failed to insert upload');

    for (const c of clients) {
      await query(
        `INSERT INTO clients (upload_id, company_name, "group", manager) VALUES ($1, $2, $3, $4)
         ON CONFLICT (upload_id, company_name) DO UPDATE SET "group" = EXCLUDED."group", manager = EXCLUDED.manager`,
        [uploadId, c.company_name, c.group ?? null, c.manager]
      );
    }

    const formatDateForDb = (date: Date) => {
      const y = date.getFullYear();
      const m = String(date.getMonth() + 1).padStart(2, '0');
      const d = String(date.getDate()).padStart(2, '0');
      return `${y}-${m}-${d}`;
    };
    const dealsWithManager = joinDealsWithManagers(deals, clients);
    for (const d of dealsWithManager) {
      const dte = d.deal_date ? formatDateForDb(d.deal_date) : null;
      await query(
        `INSERT INTO deals (upload_id, set_id, status, side, deal_date, vendor_supplier, amount_payed_usd, amount_received_usd, trade_contract_margin_usd, pct_margin, fx, manager)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
        [uploadId, d.set_id, d.status, d.side, dte, d.vendor_supplier, d.amount_payed_usd, d.amount_received_usd, d.trade_contract_margin_usd, d.pct_margin, d.fx, d.manager]
      );
    }

    return NextResponse.json({ uploadId, filename: file.name, dealsCount: deals.length });
  } catch (e) {
    console.error('Upload error:', e);
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
