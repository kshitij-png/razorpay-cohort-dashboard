# Razorpay Cohort Analysis Dashboard

A Next.js dashboard for subscription cohort analysis with NLP powered by OpenAI.

## What this does

Uploads a Razorpay CSV, lets users define subscription plans and date windows ("waves"), and calculates trialists, acquisition rates, and renewal cohorts. Users can ask plain-English questions about their data via a chat interface powered by OpenAI.

## Tech Stack

- Framework: Next.js 15 (App Router, TypeScript)
- AI: OpenAI API (gpt-4o-mini) with web_search_preview tool
- CSV parsing: Papa Parse (client-side)
- Styling: Custom CSS (CSS variables, dark mode), no frameworks
- Deployment: Vercel

## Key features

- CSV upload from Razorpay subscription exports
- Plan filtering by plan_id, plan_name, plan_amount
- Date window ("wave") based cohort calculation
- Metrics: Trialists, Acquisition, Acquisition %, Renewal 1/2/3...
- NLP chat: ask questions about current cohort data
- Web search: OpenAI automatically searches for Hindu calendar events (tithis, ekadashi, ashtami, jayantis) when questions involve date ranges

## Project structure

- `app/page.tsx` — main dashboard UI
- `app/api/analyze/route.ts` — OpenAI API route (keeps key server-side)
- `reference/` — original HTML files kept for reference

## Environment variables

- `OPENAI_API_KEY` — OpenAI API key (never expose client-side)

## Style

- Match the existing design: CSS variables, DM Sans font, warm neutral palette
- Dark mode via prefers-color-scheme
- No Tailwind, no external UI libraries
