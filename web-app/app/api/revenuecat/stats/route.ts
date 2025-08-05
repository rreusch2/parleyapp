// app/api/revenuecat/stats/route.ts
import { NextResponse } from 'next/server'

const REVENUECAT_API_KEY = process.env.REVENUECAT_API_KEY;

async function fetchAllSubscribers(appId: string) {
    let allSubscribers: any[] = [];
    let nextUrl: string | null = `/v1/projects/${appId}/subscribers`;

    while (nextUrl) {
        const response = await fetch(`https://api.revenuecat.com${nextUrl}`, {
            headers: {
                'Authorization': `Bearer ${REVENUECAT_API_KEY}`,
                'Content-Type': 'application/json',
                'X-Platform': 'ios'
            }
        });

        if (!response.ok) {
            const errorBody = await response.text();
            console.error(`RevenueCat API Error (${response.status}): ${errorBody}`);
            throw new Error(`Failed to fetch subscribers from RevenueCat API: ${response.statusText}`);
        }

        const data = await response.json();
        allSubscribers = allSubscribers.concat(data.subscribers);
        nextUrl = data.next_page_token ? `/v1/projects/${appId}/subscribers?starting_after=${data.next_page_token}` : null;
    }

    return allSubscribers;
}


export async function GET() {
  if (!REVENUECAT_API_KEY || REVENUECAT_API_KEY === 'sk_your_revenuecat_api_key_here') {
    return new NextResponse('RevenueCat API key is not set.', { status: 500 });
  }

  try {
    const projectId = '2c858a8a' // Predictive Play
    const subscribers = await fetchAllSubscribers(projectId);

    let totalRevenue = 0;
    let activeSubscriptions = 0;
    let mrr = 0;
    const monthlyRevenue: { [key: string]: number } = {};

    subscribers.forEach(subscriber => {
        // Calculate Total Revenue
        Object.values(subscriber.non_subscriptions).forEach((purchases: any) => {
            purchases.forEach((purchase: any) => {
                totalRevenue += purchase.purchase_price_in_usd;
            });
        });
         Object.values(subscriber.subscriptions).forEach((subscriptions: any) => {
            subscriptions.forEach((subscription: any) => {
                totalRevenue += subscription.purchase_price_in_usd;
                 // Active Subscriptions and MRR
                if (subscription.status === 'ACTIVE') {
                    activeSubscriptions++;
                    const monthlyPrice = subscription.period_type === 'yearly' ? subscription.purchase_price_in_usd / 12 : subscription.purchase_price_in_usd;
                    mrr += monthlyPrice;
                }
                
                // Revenue History
                const purchaseMonth = new Date(subscription.purchase_date).toISOString().slice(0, 7);
                if (!monthlyRevenue[purchaseMonth]) {
                    monthlyRevenue[purchaseMonth] = 0;
                }
                monthlyRevenue[purchaseMonth] += subscription.purchase_price_in_usd;
            });
        });
    });
    
    // Prepare data for the chart
    const sortedMonths = Object.keys(monthlyRevenue).sort();
    const chartLabels = sortedMonths.map(month => new Date(month + '-02').toLocaleString('default', { month: 'short' }));
    const chartData = sortedMonths.map(month => monthlyRevenue[month]);

    const stats = {
        totalRevenue,
        activeSubscriptions,
        mrr,
        churnRate: 0.05, // Placeholder for churn rate
        revenueHistory: {
            labels: chartLabels,
            datasets: [{
                label: 'Monthly Revenue',
                data: chartData,
                borderColor: '#3b82f6',
                backgroundColor: 'rgba(59, 130, 246, 0.2)',
                fill: true
            }]
        }
    };
    
    return NextResponse.json(stats);

  } catch (error) {
    console.error(error);
    return new NextResponse('Internal Server Error', { status: 500 });
  }
}
