import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export async function POST(req: NextRequest) {
  const { question, cohortData } = await req.json();

  const context = JSON.stringify(cohortData, null, 2);

  const response = await openai.responses.create({
    model: 'gpt-4o',
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
            x_labels: { type: 'array', items: { type: 'string' } },
            series: {
              type: 'array',
              items: {
                type: 'object',
                additionalProperties: false,
                properties: {
                  name: { type: 'string' },
                  values: { type: 'array', items: { type: 'number' } },
                },
                required: ['name', 'values'],
              },
            },
            y_axis_label: { type: 'string' },
          },
          required: ['title', 'chart_type', 'x_labels', 'series', 'y_axis_label'],
        },
      },
    ],
    instructions: `You are a data extraction assistant. The user wants a chart from cohort analysis data.
Always call create_chart. Structure x_labels as the shared dimension (e.g. wave date ranges or plan names).
Each item in series is one line or bar group — use separate series for different plans or price points.
For comparing price points of the same plan across waves: x_labels = wave date ranges, series = one per price point.
For comparing plans on a single metric: x_labels = plan names, series = one item with that metric's values.
Use bar charts for single-point comparisons, line charts for trends across multiple waves.
Keep names short — strip prices from plan names unless comparing price points (then include the price).
Round all values to whole numbers.`,
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
