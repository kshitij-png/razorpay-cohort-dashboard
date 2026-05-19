import { NextResponse } from 'next/server';

const SHEET_CSV_URL = 'https://docs.google.com/spreadsheets/d/1j6mYWLogHOvkDX4lwoN6gfUlVy3uQoM4T2Y4Nh2JbLM/export?format=csv&gid=29993840';

const CAMPAIGN_START = '2026-04-01';

const GROUP_KEYWORDS = [
  { keyword: 'khatu shyam', group: 'khatu-shyam' },
  { keyword: 'rin mukti', group: 'rin-mukti' },
  { keyword: 'gau seva', group: 'gau-seva' },
  { keyword: 'pashupatinath', group: 'pashupatinath' },
  { keyword: 'vaanar seva', group: 'vaanar-seva' },
];

const GROUP_TIMES: Record<string, string> = {
  'khatu-shyam': '16:00',
  'rin-mukti': '12:00',
  'gau-seva': '16:00',
  'pashupatinath': '12:00',
  'vaanar-seva': '16:00',
};

const MONTH_MAP: Record<string, number> = {
  jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5,
  jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11,
};

function parseSheetDate(str: string): Date | null {
  const m = str.trim().match(/^(\d{1,2})\s+(\w{3})\s+(\d{4})$/i);
  if (!m) return null;
  const month = MONTH_MAP[m[2].toLowerCase()];
  if (month === undefined) return null;
  return new Date(parseInt(m[3]), month, parseInt(m[1]));
}

function toWaveDt(date: Date, time: string): string {
  const y = date.getFullYear();
  const mo = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${mo}-${d}T${time}`;
}

const VALID_AMOUNTS = new Set(['151', '301', '501', '701']);

function identifyGroup(planEntry: string): string | null {
  const entry = planEntry.trim();
  let amount: string | null = null;

  // Format: ₹1/₹{amount} or ₹1/{amount} (second ₹ optional)
  const m1 = entry.match(/^₹1\/₹?(\d+)/);
  if (m1) amount = m1[1];

  // Format: "Plan Name" (1/{amount} Monthly/Quarterly)
  if (!amount) {
    const m2 = entry.match(/\(1\/(\d+)/);
    if (m2) amount = m2[1];
  }

  if (!amount || !VALID_AMOUNTS.has(amount)) return null;

  const lower = entry.toLowerCase();
  for (const { keyword, group } of GROUP_KEYWORDS) {
    if (lower.includes(keyword)) return group;
  }
  return null;
}

function parseCSVLine(line: string): string[] {
  const fields: string[] = [];
  let field = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      inQuotes = !inQuotes;
    } else if (ch === ',' && !inQuotes) {
      fields.push(field.trim());
      field = '';
    } else {
      field += ch;
    }
  }
  fields.push(field.trim());
  return fields;
}

export async function GET() {
  try {
    const res = await fetch(SHEET_CSV_URL, { cache: 'no-store' });
    if (!res.ok) throw new Error(`Sheet fetch failed: ${res.status}`);
    const text = await res.text();

    const rows = text.split('\n').map(parseCSVLine);
    const dataRows = rows.slice(1); // skip header

    const groupDates: Record<string, Date[]> = {};

    for (const row of dataRows) {
      const dateStr = row[1]; // column B
      const planEntry = row[7]; // column H
      if (!dateStr || !planEntry) continue;

      const date = parseSheetDate(dateStr);
      if (!date) continue;

      const group = identifyGroup(planEntry);
      if (!group) continue;

      if (!groupDates[group]) groupDates[group] = [];

      // deduplicate dates within the same group
      if (!groupDates[group].some(d => d.getTime() === date.getTime())) {
        groupDates[group].push(date);
      }
    }

    const result: Record<string, { from: string; to: string }[]> = {};

    for (const [group, dates] of Object.entries(groupDates)) {
      const time = GROUP_TIMES[group] || '16:00';
      dates.sort((a, b) => a.getTime() - b.getTime());

      const waves: { from: string; to: string }[] = [];

      // First wave always starts from campaign start
      waves.push({ from: `${CAMPAIGN_START}T${time}`, to: toWaveDt(dates[0], time) });

      // Subsequent waves: each date is the boundary between two waves
      for (let i = 0; i < dates.length - 1; i++) {
        waves.push({ from: toWaveDt(dates[i], time), to: toWaveDt(dates[i + 1], time) });
      }

      result[group] = waves;
    }

    return NextResponse.json(result);
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
