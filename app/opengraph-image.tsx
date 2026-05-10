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
      <div style={{
        background: '#0e0e0c',
        width: '100%',
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}>
        <img src={rudraBase64} style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
      </div>
    ),
    { ...size }
  );
}
