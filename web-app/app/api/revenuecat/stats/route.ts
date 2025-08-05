// app/api/revenuecat/stats/route.ts
import { NextResponse } from 'next/server'

const REVENUECAT_API_KEY = process.env.REVENUECAT_API_KEY;
const PROJECT_ID = 'appac744357a5'; // Hardcoded Project ID for "Predictive Play"

async function fetchAllSubscribers() {
    let allSubscribers: any[] = [];
    let startingAfter: string | null = null;

    do {
        const url = new URL(`https://api.revenuecat.com/v1/projects/${PROJECT_ID}/subscribers`);
        if (startingAfter) {
            url.searchParams.append('starting_after', startingAfter);
        }

        const response = await fetch(url.toString(), {
            headers: {
                'Authorization': `Bearer ${REVENUECAT_API_KEY}`,
                'Content-Type': 'application/json',
                'X-Platform': 'ios' // Assuming iOS, adjust if necessary
            }
        });

        if (!response.ok) {
            const errorBody = await response.text();
            console.error(`RevenueCat API Error (${response.status}): ${errorBody}`);
            throw new Error(`Failed to fetch subscribers from RevenueCat API: ${response.statusText}`);
        }

        const data = await response.json();
        allSubscribers = allSubscribers.concat(data.subscribers);
        startingAfter = data.next_page_token;

    } while (startingAfter);

    return allSubscribers;
}


export async function GET() {
  if (!REVENUECAT_API_KEY || REVENUECAT_API_KEY === 'sk_your_revenuecat_api_key_here') {
    return new NextResponse('RevenueCat API key is not set.', { status: 500 });
  }

  try {
    const subscribers = await fetchAllSubscribers();

    let totalRevenue = 0;
    let activeSubscriptions = 0;
    let mrr = 0;
    const monthlyRevenue: { [key: string]: number } = {};

    subscribers.forEach(subscriber => {
        // Calculate Total Revenue from all transactions
        if (subscriber.transactions) {
            subscriber.transactions.forEach((transaction: any) => {
                totalRevenue += transaction.revenue_in_usd;

                // Revenue History
                const purchaseMonth = new Date(transaction.purchase_date).toISOString().slice(0, 7);
                if (!monthlyRevenue[purchaseMonth]) {
                    monthlyRevenue[purchaseMonth] = 0;
                }
                monthlyRevenue[purchaseMonth] += transaction.revenue_in_usd;
            });
        }
        
        // Calculate Active Subscriptions and MRR from entitlements
        if (subscriber.entitlements) {
            Object.values(subscriber.entitlements).forEach((entitlement: any) => {
                if (new Date(entitlement.expires_date) > new Date()) {
                    activeSubscriptions++;
                    // This is a simplified MRR calculation. 
                    // A more accurate calculation would need to look at the subscription period.
                    // For now, we assume that the last transaction's revenue for an active sub is monthly.
                    if(subscriber.transactions && subscriber.transactions.length > 0) {
                        const lastTransaction = subscriber.transactions[subscriber.transactions.length - 1];
                        if (lastTransaction.is_sandbox === false) { // only count production transactions
                             const priceInUSD = lastTransaction.revenue_in_usd;
                             // This is still not perfect MRR, but better than nothing.
                             // It assumes the last transaction price is a monthly price.
                             mrr += priceInUSD;
                        }
                    }
                }
            });
        }
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
