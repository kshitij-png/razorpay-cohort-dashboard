'use client';

import { useState, useEffect, useRef } from 'react';
import Papa from 'papaparse';
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

// ── Types ──────────────────────────────────────────────────────
type Row = Record<string, string>;

interface PlanOption { id: string; name: string; amount: number; label: string; }
interface WaveResult { trialists: number; acquisition: number; renewals: Record<number, number>; maxPaid: number; }
interface Wave { from: string; to: string; results: WaveResult | null; }
interface Sub { id: string; planId: string; planLabel: string; waves: Record<string, Wave>; }

interface ChartData {
  title: string;
  chart_type: 'bar' | 'line';
  labels: string[];
  values: number[];
  y_axis_label: string;
}

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  chart?: ChartData;
}

// ── Helpers ────────────────────────────────────────────────────
function uid() { return 'w_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6); }
function pct(a: number, b: number) { return b === 0 ? 0 : Math.round((a / b) * 100); }

function cleanName(name: string) {
  return name.replace(/^[\s\-\*~_|.''"""'`]+/g, '').replace(/[\s\-\*~_|.''"""'`]+$/g, '').trim();
}

function parseLocalDate(dt: string): Date | null {
  if (!dt) return null;
  const [datePart, timePart] = dt.split('T');
  if (!datePart) return null;
  const [y, m, d] = datePart.split('-').map(Number);
  const [h, min] = (timePart || '00:00').split(':').map(Number);
  return new Date(y, m - 1, d, h || 0, min || 0, 0);
}

function parseRowDate(str: string): Date | null {
  if (!str) return null;
  str = str.trim();
  const m1 = str.match(/^(\d{2})\/(\d{2})\/(\d{4}) (\d{2}):(\d{2})(?::(\d{2}))?$/);
  if (m1) return new Date(+m1[3], +m1[2]-1, +m1[1], +m1[4], +m1[5], +(m1[6]||0));
  const m2 = str.match(/^(\d{2})-(\d{2})-(\d{4}) (\d{2}):(\d{2})(?::(\d{2}))?$/);
  if (m2) return new Date(+m2[3], +m2[2]-1, +m2[1], +m2[4], +m2[5], +(m2[6]||0));
  const m3 = str.match(/^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::(\d{2}))?/);
  if (m3) return new Date(+m3[1], +m3[2]-1, +m3[3], +m3[4], +m3[5], +(m3[6]||0));
  const d = new Date(str);
  return isNaN(d.getTime()) ? null : d;
}

function calcWaveResults(allData: Row[], planId: string, from: string, to: string): WaveResult | null {
  const tsFrom = parseLocalDate(from);
  const tsTo = parseLocalDate(to);
  if (!tsFrom || !tsTo) return null;
  const rows = allData.filter(r => {
    if (planId && r.plan_id !== planId) return false;
    const d = parseRowDate(r.created_at);
    return d ? d >= tsFrom && d <= tsTo : false;
  });
  const trialistRows = rows.filter(r => { const v = (r.authenticated_at || '').trim(); return v !== '' && v !== '0'; });
  let maxPaid = 1;
  trialistRows.forEach(r => { const pc = parseInt(r.paid_count || '0', 10); if (pc > maxPaid) maxPaid = pc; });
  const acquisition = trialistRows.filter(r => parseInt(r.paid_count || '0', 10) >= 1).length;
  const renewals: Record<number, number> = {};
  for (let n = 1; n <= maxPaid - 1; n++) renewals[n] = trialistRows.filter(r => parseInt(r.paid_count || '0', 10) >= n + 1).length;
  return { trialists: trialistRows.length, acquisition, renewals, maxPaid };
}

function buildPlanOptions(data: Row[]) {
  const seen = new Set<string>();
  const options: PlanOption[] = [];
  data.forEach(r => {
    const id = (r.plan_id || '').trim();
    if (!id || seen.has(id)) return;
    seen.add(id);
    const rawName = (r.plan_name || '').trim();
    const name = cleanName(rawName) || rawName;
    const amount = parseFloat(r.plan_amount) || 0;
    const label = name + (amount > 0 ? ' — ₹' + amount.toLocaleString('en-IN', { maximumFractionDigits: 0 }) : '');
    options.push({ id, name, amount, label });
  });
  options.sort((a, b) => a.name.localeCompare(b.name) || a.amount - b.amount);
  const map: Record<string, PlanOption> = {};
  options.forEach(p => { map[p.id] = p; });
  return { options, map };
}

function getPresetWaves(label: string) {
  const l = label.toLowerCase();
  if (l.includes('khatu shyam')) return [
    { from: '2026-04-01T16:00', to: '2026-04-09T16:00' },
    { from: '2026-04-09T16:00', to: '2026-04-16T16:00' },
    { from: '2026-04-16T16:00', to: '2026-04-19T16:00' },
    { from: '2026-04-19T16:00', to: '2026-04-23T16:00' },
  ];
  if (l.includes('gau seva')) return [
    { from: '2026-04-01T16:00', to: '2026-04-15T16:00' },
    { from: '2026-04-15T16:00', to: '2026-04-19T16:00' },
    { from: '2026-04-19T16:00', to: '2026-04-22T16:00' },
  ];
  if (l.includes('rin mukti')) return [
    { from: '2026-04-01T12:00', to: '2026-04-13T12:00' },
    { from: '2026-04-13T12:00', to: '2026-04-20T12:00' },
  ];
  if (l.includes('pashupatinath')) return [{ from: '2026-04-01T12:00', to: '2026-04-20T12:00' }];
  return null;
}

const PRESET_PLANS = [
  { name: 'Khatu Shyam Ji Chadhava', amount: 501 },
  { name: 'Khatu Shyam Ji Chadhava', amount: 301 },
  { name: 'Khatu Shyam Ji Chadhava', amount: 151 },
  { name: 'Rin Mukti Chadhava', amount: 501 },
  { name: 'Rin Mukti Chadhava', amount: 301 },
  { name: 'Rin Mukti Chadhava', amount: 151 },
  { name: 'Gau Seva', amount: 501 },
  { name: 'Gau Seva', amount: 301 },
  { name: 'Gau Seva', amount: 151 },
  { name: 'Pashupatinath Vishesh: Sarva Rog Nivaran Chadhava', amount: 501 },
];

const SUGGESTED_QUESTIONS = [
  'Which plan had the best acquisition rate?',
  'Why was April 1–9 so strong?',
];

// ── Markdown renderer (bold only) ──────────────────────────────
function renderMarkdown(text: string) {
  const parts = text.split(/\*\*(.*?)\*\*/g);
  return parts.map((part, i) =>
    i % 2 === 1 ? <strong key={i}>{part}</strong> : part
  );
}

// ── Chart Block ────────────────────────────────────────────────
function ChartBlock({ chart }: { chart: ChartData }) {
  const data = chart.labels.map((label, i) => ({ name: label, value: chart.values[i] }));
  return (
    <div className="chart-block">
      <div className="chart-title">{chart.title}</div>
      <ResponsiveContainer width="100%" height={240}>
        {chart.chart_type === 'bar' ? (
          <BarChart data={data} margin={{ top: 8, right: 16, left: 0, bottom: 50 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border2)" />
            <XAxis dataKey="name" tick={{ fontSize: 10, fill: 'var(--text2)' }} angle={-30} textAnchor="end" interval={0} />
            <YAxis tick={{ fontSize: 10, fill: 'var(--text2)' }} label={{ value: chart.y_axis_label, angle: -90, position: 'insideLeft', style: { fontSize: 10, fill: 'var(--text3)' } }} />
            <Tooltip contentStyle={{ background: 'var(--surface)', border: '1px solid var(--border2)', borderRadius: 8, fontSize: 12 }} />
            <Bar dataKey="value" fill="var(--accent)" radius={[4, 4, 0, 0]} />
          </BarChart>
        ) : (
          <LineChart data={data} margin={{ top: 8, right: 16, left: 0, bottom: 50 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border2)" />
            <XAxis dataKey="name" tick={{ fontSize: 10, fill: 'var(--text2)' }} angle={-30} textAnchor="end" interval={0} />
            <YAxis tick={{ fontSize: 10, fill: 'var(--text2)' }} label={{ value: chart.y_axis_label, angle: -90, position: 'insideLeft', style: { fontSize: 10, fill: 'var(--text3)' } }} />
            <Tooltip contentStyle={{ background: 'var(--surface)', border: '1px solid var(--border2)', borderRadius: 8, fontSize: 12 }} />
            <Line type="monotone" dataKey="value" stroke="var(--accent)" strokeWidth={2} dot={{ r: 3, fill: 'var(--accent)' }} />
          </LineChart>
        )}
      </ResponsiveContainer>
    </div>
  );
}

// ── Main Page ──────────────────────────────────────────────────
export default function Home() {
  const [allData, setAllData] = useState<Row[]>([]);
  const [planOptions, setPlanOptions] = useState<PlanOption[]>([]);
  const [planMap, setPlanMap] = useState<Record<string, PlanOption>>({});
  const [subs, setSubs] = useState<Sub[]>([]);
  const [hasData, setHasData] = useState(false);
  const [fileName, setFileName] = useState('');
  const [question, setQuestion] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [nlpLoading, setNlpLoading] = useState(false);
  const [darkMode, setDarkMode] = useState<'light' | 'dark' | null>(null);
  const [copied, setCopied] = useState<number | null>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const nlpInputRef = useRef<HTMLInputElement>(null);
  const nlpFocused = useRef(false);

  // Dark mode
  useEffect(() => {
    if (darkMode) {
      document.documentElement.setAttribute('data-theme', darkMode);
    } else {
      document.documentElement.removeAttribute('data-theme');
    }
  }, [darkMode]);

  // Init dark mode from system preference
  useEffect(() => {
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    setDarkMode(prefersDark ? 'dark' : 'light');
  }, []);

  useEffect(() => {
    const container = messagesContainerRef.current;
    if (container) container.scrollTop = container.scrollHeight;
  }, [messages]);

  // ── CSV Upload ─────────────────────────────────────────────
  function handleFile(file: File) {
    setFileName(file.name.length > 24 ? file.name.slice(0, 22) + '…' : file.name);
    Papa.parse<Row>(file, {
      header: true, skipEmptyLines: true,
      complete(results) {
        if (!results.data?.length) { alert('Could not parse CSV.'); return; }
        const data = results.data;
        setAllData(data);
        const { options, map } = buildPlanOptions(data);
        setPlanOptions(options);
        setPlanMap(map);
        setHasData(true);
        const newSubs: Sub[] = [];
        PRESET_PLANS.forEach(preset => {
          const keyword = preset.name.toLowerCase().split(':')[0].trim();
          const match = options.find(p => p.name.toLowerCase().includes(keyword) && p.amount === preset.amount);
          if (match) {
            const presets = getPresetWaves(match.label);
            const waves: Record<string, Wave> = {};
            if (presets) presets.forEach(p => { const wid = uid(); waves[wid] = { from: p.from, to: p.to, results: calcWaveResults(data, match.id, p.from, p.to) }; });
            else waves[uid()] = { from: '', to: '', results: null };
            newSubs.push({ id: uid(), planId: match.id, planLabel: match.label, waves });
          }
        });
        if (newSubs.length === 0) newSubs.push({ id: uid(), planId: '', planLabel: '', waves: { [uid()]: { from: '', to: '', results: null } } });
        setSubs(newSubs);
      },
      error() { alert('Error reading file.'); }
    });
  }

  // ── Sub operations ─────────────────────────────────────────
  function addSub() {
    const lastSub = subs[subs.length - 1];
    const waves: Record<string, Wave> = lastSub
      ? Object.fromEntries(Object.values(lastSub.waves).map(w => [uid(), { from: w.from, to: w.to, results: null }]))
      : { [uid()]: { from: '', to: '', results: null } };
    setSubs(prev => [...prev, { id: uid(), planId: '', planLabel: '', waves }]);
  }

  function removeSub(subId: string) { setSubs(prev => prev.filter(s => s.id !== subId)); }

  function selectPlan(subId: string, planId: string, planLabel: string) {
    setSubs(prev => prev.map(s => {
      if (s.id !== subId) return s;
      let waves = s.waves;
      if (planId) {
        const presets = getPresetWaves(planLabel);
        if (presets) {
          const nw: Record<string, Wave> = {};
          presets.forEach(p => { const wid = uid(); nw[wid] = { from: p.from, to: p.to, results: calcWaveResults(allData, planId, p.from, p.to) }; });
          waves = nw;
        } else {
          waves = Object.fromEntries(Object.entries(s.waves).map(([wid, w]) => [wid, { ...w, results: calcWaveResults(allData, planId, w.from, w.to) }]));
        }
      }
      return { ...s, planId, planLabel, waves };
    }));
  }

  function addWave(subId: string) {
    setSubs(prev => prev.map(s => {
      if (s.id !== subId) return s;
      const existing = Object.values(s.waves);
      const lastTo = existing.length > 0 ? existing[existing.length - 1].to : '';
      const wid = uid();
      return { ...s, waves: { ...s.waves, [wid]: { from: lastTo, to: '', results: null } } };
    }));
  }

  function removeWave(subId: string, waveId: string) {
    setSubs(prev => prev.map(s => {
      if (s.id !== subId) return s;
      const updated = { ...s.waves };
      delete updated[waveId];
      return { ...s, waves: updated };
    }));
  }

  function updateWave(subId: string, waveId: string, field: 'from' | 'to', val: string) {
    setSubs(prev => prev.map(s => {
      if (s.id !== subId) return s;
      const w = s.waves[waveId];
      const updated = { ...w, [field]: val };
      updated.results = calcWaveResults(allData, s.planId, updated.from, updated.to);
      return { ...s, waves: { ...s.waves, [waveId]: updated } };
    }));
  }

  // ── NLP ────────────────────────────────────────────────────
  function insertAtCursor(text: string) {
    const input = nlpInputRef.current;
    if (!input) return;
    const start = input.selectionStart ?? question.length;
    const end = input.selectionEnd ?? question.length;
    const newVal = question.slice(0, start) + text + question.slice(end);
    setQuestion(newVal);
    requestAnimationFrame(() => {
      input.focus();
      input.setSelectionRange(start + text.length, start + text.length);
    });
  }

  async function handleAsk(q?: string) {
    const text = (q ?? question).trim();
    if (!text || nlpLoading) return;
    setQuestion('');
    const isFirst = messages.length === 0;
    const newMessages: ChatMessage[] = [...messages, { role: 'user', content: text }];
    setMessages(newMessages);
    setNlpLoading(true);

    const cohortData = subs.map(s => ({
      plan: s.planLabel.split(' — ₹')[0].trim() || 'All plans',
      waves: Object.values(s.waves).map(w => ({
        from: w.from, to: w.to,
        trialists: w.results?.trialists ?? null,
        acquisition: w.results?.acquisition ?? null,
        acquisitionPct: w.results && w.results.trialists > 0 ? pct(w.results.acquisition, w.results.trialists) : null,
        renewals: w.results?.renewals ?? null,
      })),
    }));

    const isChartRequest = /chart|graph|plot/i.test(text);

    try {
      if (isChartRequest) {
        const res = await fetch('/api/chart', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ question: text, cohortData }),
        });
        const data = await res.json();
        setMessages(prev => [...prev, { role: 'assistant', content: '', chart: data.chart }]);
      } else {
        const res = await fetch('/api/analyze', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ question: text, cohortData, history: messages }),
        });
        const data = await res.json();
        const answer = isFirst ? 'Namaste 🙏\n\n' + (data.answer ?? '') : (data.answer ?? '');
        setMessages(prev => [...prev, { role: 'assistant', content: answer }]);
      }
    } catch {
      setMessages(prev => [...prev, { role: 'assistant', content: 'Something went wrong. Please try again.' }]);
    }
    setNlpLoading(false);
  }

  function copyMessage(content: string, idx: number) {
    navigator.clipboard.writeText(content).then(() => {
      setCopied(idx);
      setTimeout(() => setCopied(null), 2000);
    });
  }

  // ── Exports ────────────────────────────────────────────────
  function exportCSV() {
    const rows: (string | number)[][] = [];
    subs.forEach(sub => {
      const maxR = Math.max(0, ...Object.values(sub.waves).map(w => w.results ? w.results.maxPaid - 1 : 0));
      rows.push([sub.planLabel || 'All plans']);
      const headers = ['From date', 'From time', 'To date', 'To time', 'Trialists', 'Acquisition', 'Acq %'];
      for (let r = 1; r <= maxR; r++) headers.push(`Renewal ${r}`, `R${r} %`);
      rows.push(headers);
      Object.values(sub.waves).forEach(w => {
        if (!w.results) return;
        const [fd = '—', ft = '—'] = w.from ? w.from.split('T') : [];
        const [td = '—', tt = '—'] = w.to ? w.to.split('T') : [];
        const cells: (string | number)[] = [fd, ft, td, tt, w.results.trialists, w.results.acquisition, pct(w.results.acquisition, w.results.trialists)];
        for (let r = 1; r <= maxR; r++) { const rv = w.results.renewals[r] ?? 0; cells.push(rv, w.results.acquisition > 0 ? pct(rv, w.results.acquisition) : 0); }
        rows.push(cells);
      });
      rows.push([]);
    });
    const escape = (v: string | number) => { const s = String(v ?? ''); return (s.includes(',') || s.includes('"') || s.includes('\n')) ? `"${s.replace(/"/g, '""')}"` : s; };
    const csv = rows.map(r => r.map(escape).join(',')).join('\r\n');
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `cohort_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  const isDark = darkMode === 'dark';

  // ── Render ─────────────────────────────────────────────────
  return (
    <>
      <div className="topbar">
        <div className="topbar-left">
          <div className="logo">CA</div>
          <h1>Cohort Analysis Copilot V1</h1>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          {fileName && <div className="file-badge">{fileName}</div>}
          {hasData && (
            <>
              <button className="export-action-btn" onClick={() => window.print()}>Export PDF</button>
              <button className="export-action-btn" onClick={exportCSV}>Download CSV</button>
            </>
          )}
          <button
            className="theme-toggle"
            onClick={() => setDarkMode(isDark ? 'light' : 'dark')}
            title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
          >
            {isDark ? '🪔' : '🌙'}
          </button>
          <label className="upload-btn">
            Upload CSV
            <input type="file" accept=".csv" style={{ display: 'none' }}
              onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = ''; }} />
          </label>
        </div>
      </div>

      <div className="main">
        <div className="page-intro">
          <h2>Subscription cohort comparison</h2>
          <p>Upload your CSV, add subscription plans and time windows to compare trialists, acquisitions, and renewal cohorts side by side.</p>
        </div>

        {!hasData && (
          <div className="upload-prompt">
            <p>Upload a CSV file to get started</p>
          </div>
        )}

        {hasData && (
          <>
            {/* ── Rudra AI ── */}
            <div className="nlp-section">
              <div className="nlp-header">
                <div className="nlp-header-left">
                  <img src="/rudra.png" alt="Rudra" className="rudra-avatar" />
                  <div>
                    <div className="nlp-title">Rudra AI — Ask me anything about your data 🙏</div>
                    <div className="nlp-sub">Click any wave row while typing to insert it. For date-range questions, Hindu calendar events are checked automatically.</div>
                  </div>
                </div>
                {messages.length > 0 && (
                  <button className="nlp-clear-btn" onClick={() => setMessages([])}>Clear</button>
                )}
              </div>

              {messages.length > 0 && (
                <div className="nlp-messages" ref={messagesContainerRef}>
                  {messages.map((m, i) => (
                    <div key={i} className={`nlp-msg nlp-msg-${m.role}`}>
                      <div className="nlp-msg-label">
                        {m.role === 'user' ? 'You' : '🪔 Rudra AI'}
                      </div>
                      <div className="nlp-msg-content">
                        {m.chart ? <ChartBlock chart={m.chart} /> : (m.role === 'assistant' ? renderMarkdown(m.content) : m.content)}
                      </div>
                      {m.role === 'assistant' && (
                        <button className="copy-btn" onClick={() => copyMessage(m.content, i)}>
                          {copied === i ? '✓ Copied' : 'Copy'}
                        </button>
                      )}
                    </div>
                  ))}
                  {nlpLoading && (
                    <div className="nlp-msg nlp-msg-assistant">
                      <div className="nlp-msg-label">🪔 Rudra AI</div>
                      <div className="nlp-msg-content nlp-thinking">
                        Pandit ji soch rahe hai
                        <span className="thinking-dots">
                          <span className="dot">.</span>
                          <span className="dot">.</span>
                          <span className="dot">.</span>
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {messages.length === 0 && (
                <div className="suggested-questions">
                  {SUGGESTED_QUESTIONS.map((sq, i) => (
                    <button key={i} className="suggested-chip" onClick={() => handleAsk(sq)}>
                      {sq}
                    </button>
                  ))}
                </div>
              )}

              <div className="nlp-input-row">
                <input
                  ref={nlpInputRef}
                  className="nlp-input"
                  type="text"
                  placeholder="Ask Rudra AI anything about your cohorts…"
                  value={question}
                  onChange={e => setQuestion(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleAsk(); } }}
                  onFocus={() => { nlpFocused.current = true; }}
                  onBlur={() => { nlpFocused.current = false; }}
                  disabled={nlpLoading}
                />
                <button className="nlp-send-btn" onClick={() => handleAsk()} disabled={nlpLoading || !question.trim()}>
                  {nlpLoading ? '…' : 'Ask'}
                </button>
              </div>
            </div>

            <div className="subs-gap" />

            {subs.map((sub, idx) => (
              <SubBlock
                key={sub.id}
                sub={sub}
                idx={idx}
                planOptions={planOptions}
                planMap={planMap}
                onSelectPlan={(planId, planLabel) => selectPlan(sub.id, planId, planLabel)}
                onRemove={() => removeSub(sub.id)}
                onAddWave={() => addWave(sub.id)}
                onRemoveWave={wid => removeWave(sub.id, wid)}
                onUpdateWave={(wid, field, val) => updateWave(sub.id, wid, field, val)}
                nlpFocused={nlpFocused}
                onWaveClick={(planName, from, to) => insertAtCursor(`${planName}, ${from} to ${to}`)}
              />
            ))}

            <button className="add-sub-btn" onClick={addSub}>+ Add subscription plan</button>
          </>
        )}
      </div>
    </>
  );
}

// ── SubBlock ───────────────────────────────────────────────────
function SubBlock({ sub, idx, planOptions, onSelectPlan, onRemove, onAddWave, onRemoveWave, onUpdateWave, nlpFocused, onWaveClick }: {
  sub: Sub; idx: number;
  planOptions: PlanOption[];
  planMap: Record<string, PlanOption>;
  onSelectPlan: (planId: string, planLabel: string) => void;
  onRemove: () => void; onAddWave: () => void;
  onRemoveWave: (wid: string) => void;
  onUpdateWave: (wid: string, field: 'from' | 'to', val: string) => void;
  nlpFocused: React.RefObject<boolean>;
  onWaveClick: (planName: string, from: string, to: string) => void;
}) {
  const [search, setSearch] = useState(sub.planLabel);
  const [ddOpen, setDdOpen] = useState(false);

  useEffect(() => { setSearch(sub.planLabel); }, [sub.planLabel]);

  const planNameOnly = sub.planLabel.split(' — ₹')[0].trim();

  function formatDate(dt: string) {
    if (!dt) return '';
    const [datePart, timePart] = dt.split('T');
    if (!datePart) return dt;
    const [, m, d] = datePart.split('-');
    const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    return `${parseInt(d)} ${months[parseInt(m) - 1]}${timePart ? ' ' + timePart : ''}`.trim();
  }

  function handleRowMouseDown(w: Wave) {
    if (!nlpFocused.current || !w.from || !w.to) return;
    onWaveClick(planNameOnly || 'All plans', formatDate(w.from), formatDate(w.to));
  }

  const filtered = search && !sub.planId
    ? planOptions.filter(p => p.name.toLowerCase().includes(search.toLowerCase()) || String(p.amount).includes(search))
    : planOptions;

  const waves = Object.entries(sub.waves);
  const maxR = Math.max(0, ...waves.map(([, w]) => w.results ? w.results.maxPaid - 1 : 0));

  let sumTrialists = 0, sumAcq = 0;
  const sumR: Record<number, number> = {};
  let hasAnyResult = false;
  waves.forEach(([, w]) => {
    if (!w.results) return;
    hasAnyResult = true;
    sumTrialists += w.results.trialists;
    sumAcq += w.results.acquisition;
    for (let r = 1; r <= maxR; r++) sumR[r] = (sumR[r] || 0) + (w.results.renewals[r] ?? 0);
  });

  const renewalCols = Array.from({ length: maxR }, (_, i) => i + 1);

  return (
    <div className="sub-block">
      <div className="sub-header">
        <div className="sub-num">{idx + 1}</div>
        <div className="sub-plan-wrap">
          <input
            type="text"
            className={`sub-plan-input${sub.planId ? ' has-value' : ''}`}
            placeholder="Search plan by name or amount…"
            value={search}
            onFocus={() => setDdOpen(true)}
            onBlur={() => setTimeout(() => setDdOpen(false), 150)}
            onChange={e => { setSearch(e.target.value); onSelectPlan('', ''); }}
          />
          {ddOpen && (
            <div className="plan-dd">
              <div className="plan-opt all-opt" onMouseDown={() => { onSelectPlan('', ''); setSearch(''); }}>All plans</div>
              {filtered.map(p => (
                <div key={p.id} className="plan-opt" onMouseDown={() => onSelectPlan(p.id, p.label)}>
                  <span className="plan-opt-name">{p.name}</span>
                  <span className="plan-opt-price">₹{p.amount.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</span>
                </div>
              ))}
            </div>
          )}
        </div>
        <button className="remove-sub-btn" onClick={onRemove}>×</button>
      </div>

      <div className="waves-wrap">
        <div className="waves-table-scroll">
          <table className="waves-table">
            <thead>
              <tr>
                <th>From</th><th>To</th>
                <th className="out-col">Trialists</th>
                <th className="out-col">Acquisition</th>
                <th className="out-col">Acq %</th>
                {renewalCols.map(r => [
                  <th key={`rh-${r}`} className="out-col">Renewal {r}</th>,
                  <th key={`rph-${r}`} className="out-col">R{r} %</th>,
                ])}
                <th></th>
              </tr>
            </thead>
            <tbody>
              {waves.map(([wid, w]) => {
                const res = w.results;
                const acqPct = res && res.trialists > 0 ? pct(res.acquisition, res.trialists) : null;
                return (
                  <tr key={wid} onMouseDown={() => handleRowMouseDown(w)} style={{ cursor: 'default' }}>
                    <td><input type="datetime-local" className="wave-input" value={w.from} onChange={e => onUpdateWave(wid, 'from', e.target.value)} /></td>
                    <td><input type="datetime-local" className="wave-input" value={w.to} onChange={e => onUpdateWave(wid, 'to', e.target.value)} /></td>
                    <td className="out-cell">{res ? <span className="renewal-val">{res.trialists.toLocaleString()}</span> : <span className="out-empty">—</span>}</td>
                    <td className="out-cell">{res ? <span className="renewal-val">{res.acquisition.toLocaleString()}</span> : <span className="out-empty">—</span>}</td>
                    <td className="out-cell">{acqPct !== null ? <span style={{ color: 'var(--accent-text)', fontWeight: 600 }}>{acqPct}%</span> : <span className="out-empty">—</span>}</td>
                    {renewalCols.map(r => {
                      const rv = res ? (res.renewals[r] ?? 0) : null;
                      const rp = res && res.acquisition > 0 ? pct(rv!, res.acquisition) : null;
                      return [
                        <td key={`rv-${wid}-${r}`} className="out-cell">{rv !== null ? <span className="renewal-val">{rv.toLocaleString()}</span> : <span className="out-empty">—</span>}</td>,
                        <td key={`rp-${wid}-${r}`} className="out-cell">{rp !== null ? <span style={{ color: 'var(--accent-text)', fontWeight: 600 }}>{rp}%</span> : <span className="out-empty">—</span>}</td>,
                      ];
                    })}
                    <td><button className="remove-wave-btn" onClick={() => onRemoveWave(wid)}>×</button></td>
                  </tr>
                );
              })}
              {hasAnyResult && waves.length > 1 && (
                <tr className="sum-row">
                  <td className="sum-label" colSpan={2}>Total</td>
                  <td className="out-cell"><span className="renewal-val">{sumTrialists.toLocaleString()}</span></td>
                  <td className="out-cell"><span className="renewal-val">{sumAcq.toLocaleString()}</span></td>
                  <td className="out-cell"><span style={{ color: 'var(--accent-text)', fontWeight: 600 }}>{sumTrialists > 0 ? pct(sumAcq, sumTrialists) : 0}%</span></td>
                  {renewalCols.map(r => {
                    const rv = sumR[r] ?? 0;
                    const rp = sumAcq > 0 ? pct(rv, sumAcq) : 0;
                    return [
                      <td key={`srv-${r}`} className="out-cell"><span className="renewal-val">{rv.toLocaleString()}</span></td>,
                      <td key={`srp-${r}`} className="out-cell"><span style={{ color: 'var(--accent-text)', fontWeight: 600 }}>{rp}%</span></td>,
                    ];
                  })}
                  <td></td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <button className="add-wave-btn" onClick={onAddWave}>+ Add time window</button>
      </div>
    </div>
  );
}
