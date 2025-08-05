// app/api/revenuecat/revenue/route.ts
import { NextResponse } from 'next/server';

const REVENUECAT_API_KEY = process.env.REVENUECAT_API_KEY;

async function fetchRevenueData(
  metric: string,
  aggregation: string,
  interval: 'day' | 'week' | 'month' | 'quarter' | 'year',
  project_id: string,
  start_date: string,
  end_date: string
) {
  const url = new URL('https://api.revenuecat.com/v1/charts/revenue');
  const params = new URLSearchParams({
    metric,
    aggregation,
    interval,
    project_id,
    start_date,
    end_date,
  });
  url.search = params.toString();

  const response = await fetch(url.toString(), {
    headers: {
      Authorization: `Bearer ${REVENUECAT_API_KEY}`,
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    const errorBody = await response.text();
    console.error(`RevenueCat API Error (${response.status}): ${errorBody}`);
    throw new Error(`Failed to fetch revenue data from RevenueCat API: ${response.statusText}`);
  }

  return response.json();
}

export async function GET(request: Request) {
  if (!REVENUECAT_API_KEY || REVENUECAT_API_KEY === 'sk_your_revenuecat_api_key_here') {
    return new NextResponse('RevenueCat API key is not set.', { status: 500 });
  }

  const { searchParams } = new URL(request.url);
  const startDate = searchParams.get('start_date');
  const endDate = searchParams.get('end_date');
  const projectId = searchParams.get('project_id');
  const aggregation = searchParams.get('aggregation') || 'total';
  const interval = (searchParams.get('interval') as 'day' | 'week' | 'month' | 'quarter' | 'year') || 'day';

  if (!startDate || !endDate || !projectId) {
    return new NextResponse('Missing required query parameters: start_date, end_date, project_id', {
      status: 400,
    });
  }

  try {
    const revenueData = await fetchRevenueData(
      'revenue',
      aggregation,
      interval,
      projectId,
      startDate,
      endDate
    );

    return NextResponse.json(revenueData);
  } catch (error) {
    console.error(error);
    return new NextResponse('Internal Server Error', { status: 500 });
  }
}
