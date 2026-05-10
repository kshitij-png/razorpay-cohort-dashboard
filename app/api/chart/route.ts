import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export async function POST(req: NextRequest) {
  const { question, cohortData } = await req.json();

  const context = JSON.stringify(cohortData, null, 2);

  const response = await openai.responses.create({
    model: 'gpt-4o-mini',
    tools: [
      {
        type: 'function' as const,
        strict: true,
        name: 'create_chart',
        description: 'Extract cohort data and structure it for chart rendering',
        parameters: {
          type: 'object',
          additionalProperties: false,
          properties: {
            title: { type: 'string' },
            chart_type: { type: 'string', enum: ['bar', 'line'] },
            labels: { type: 'array', items: { type: 'string' } },
            values: { type: 'array', items: { type: 'number' } },
            y_axis_label: { type: 'string' },
          },
          required: ['title', 'chart_type', 'labels', 'values', 'y_axis_label'],
        },
      },
    ],
    instructions: `You are a data extraction assistant. The user wants a chart from cohort analysis data.
Extract the relevant numbers and labels from the cohort data to fulfil the chart request.
Always call create_chart. Use bar charts for comparisons across plans, line charts for trends over time.
Keep labels short — use plan names without prices. Round values to whole numbers.`,
    input: `Cohort data:\n${context}\n\nChart request: ${question}`,
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  for (const item of response.output as any[]) {
    if (item.type === 'function_call' && item.name === 'create_chart') {
      try {
        const chart = JSON.parse(item.arguments);
        return NextResponse.json({ chart });
      } catch {
        return NextResponse.json({ error: 'Failed to parse chart data' }, { status: 500 });
      }
    }
  }

  return NextResponse.json({ error: 'No chart data returned' }, { status: 500 });
}
