import { describe, it, expect } from 'vitest';
import * as XLSX from 'xlsx';
import { parseExcel } from './parse-excel';

/** Создаёт минимальный Excel buffer с листом DEALS для теста PIPELINE DELIMITER */
function createDealsExcel(rows: (string | number)[][]): ArrayBuffer {
  const header = [
    'Status',
    'SIDE',
    'DEAL DATE',
    'VENDOR SUPPLIER',
    ...Array(40).fill(''),
    'AMOUNT TO BE PAYED USD',
    'AMOUNT TO BE RECEIVED USD',
    '',
    'TRADE CONTRACT MARGIN USD',
  ];
  const data = [header, ...rows];
  const ws = XLSX.utils.aoa_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'DEALS');
  return XLSX.write(wb, { type: 'array', bookType: 'xlsx' }) as unknown as ArrayBuffer;
}

describe('parseExcel PIPELINE DELIMITER', () => {
  it('останавливается на строке с PIPELINE DELIMITER, сделки после не попадают в результат', () => {
    const rows = [
      ['', 'IMPORT', '2026-03-01', 'V1', ...Array(45).fill(''), 100, 200, 0, 50],
      ['', 'IMPORT', '2026-03-01', 'V2', ...Array(45).fill(''), 150, 250, 0, 80],
      ['', '', '', ''], // пустая — конец сета 1
      ['', 'EXPORT', '2026-03-02', 'V3', ...Array(45).fill(''), 0, 100, 0, -30],
      ['== PIPELINE DELIMITER =='], // разделитель
      ['', 'IMPORT', '2026-03-03', 'V4', ...Array(45).fill(''), 9999, 9999, 0, 9999], // после — не должно попасть
      ['', 'IMPORT', '2026-03-04', 'V5', ...Array(45).fill(''), 8888, 8888, 0, 8888], // тоже после
    ];
    const buf = createDealsExcel(rows);
    const result = parseExcel(buf);

    expect(result.deals).toHaveLength(3); // только 3 сделки до разделителя
    expect(result.deals.map((d) => d.vendor_supplier)).toEqual(['V1', 'V2', 'V3']);
    expect(result.deals.some((d) => d.vendor_supplier === 'V4')).toBe(false);
    expect(result.deals.some((d) => d.vendor_supplier === 'V5')).toBe(false);
    expect(result.closedSetsCount).toBe(2); // 2 сета до разделителя
  });

  it('распознаёт PIPELINE DELIMITER в разных форматах', () => {
    const rows = [
      ['', 'IMPORT', '2026-03-01', 'V1', ...Array(45).fill(''), 100, 200, 0, 50],
      ['  == PIPELINE DELIMITER ==  '], // с пробелами
      ['', 'IMPORT', '2026-03-02', 'V2', ...Array(45).fill(''), 200, 300, 0, 100],
    ];
    const buf = createDealsExcel(rows);
    const result = parseExcel(buf);

    expect(result.deals).toHaveLength(1);
    expect(result.deals[0].vendor_supplier).toBe('V1');
  });
});
