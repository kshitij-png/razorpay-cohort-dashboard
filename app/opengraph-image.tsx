import { ImageResponse } from 'next/og';
import { readFile } from 'fs/promises';
import path from 'path';

export const alt = 'Cohort Analysis Copilot V1 — Powered by Rudra AI';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default async function Image() {
  const rudraData = await readFile(path.join(process.cwd(), 'public/rudra.png'));
  const rudraBase64 = `data:image/png;base64,${rudraData.toString('base64')}`;

  return new ImageResponse(
    (
      <div
        style={{
          background: 'linear-gradient(135deg, #0e0e0c 0%, #1a1917 60%, #111827 100%)',
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          padding: '60px 80px',
          fontFamily: 'sans-serif',
          position: 'relative',
        }}
      >
        {/* Subtle grid overlay */}
        <div style={{
          position: 'absolute', inset: 0,
          backgroundImage: 'radial-gradient(circle at 80% 20%, rgba(107,158,255,0.08) 0%, transparent 60%)',
          display: 'flex',
        }} />

        {/* Rudra avatar */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: 200, height: 200,
          borderRadius: '50%',
          border: '3px solid #6b9eff',
          boxShadow: '0 0 30px rgba(107,158,255,0.4), 0 0 60px rgba(107,158,255,0.15)',
          flexShrink: 0,
          overflow: 'hidden',
          background: '#1a1917',
        }}>
          <img src={rudraBase64} style={{ width: 200, height: 200, objectFit: 'cover' }} />
        </div>

        {/* Text content */}
        <div style={{ marginLeft: 64, display: 'flex', flexDirection: 'column', flex: 1 }}>
          <div style={{ fontSize: 18, color: '#6b9eff', fontWeight: 600, letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 16 }}>
            Rudra AI
          </div>
          <div style={{ fontSize: 58, fontWeight: 700, color: '#f2efe9', lineHeight: 1.1, marginBottom: 8 }}>
            Cohort Analysis
          </div>
          <div style={{ fontSize: 58, fontWeight: 700, color: '#6b9eff', lineHeight: 1.1, marginBottom: 28 }}>
            Copilot V1
          </div>
          <div style={{ fontSize: 22, color: '#b0ada6', lineHeight: 1.5 }}>
            Trialists · Acquisitions · Renewals · Hindu Calendar Context
          </div>
        </div>
      </div>
    ),
    { ...size }
  );
}
