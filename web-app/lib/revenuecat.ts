// RevenueCat API v2 integration for comprehensive admin dashboard
export interface RevenueCatSubscriber {
  subscriber: {
    app_user_id: string
    original_app_user_id: string
    first_seen: string
    last_seen: string
    attributes: Record<string, any>
    entitlements: Record<string, {
      expires_date: string | null
      product_identifier: string
      purchase_date: string
    }>
    subscriptions: Record<string, {
      expires_date: string | null
      purchase_date: string
      original_purchase_date: string
      period_type: 'trial' | 'normal' | 'promotional'
      store: 'app_store' | 'play_store' | 'stripe'
      is_sandbox: boolean
      unsubscribe_detected_at: string | null
      billing_issues_detected_at: string | null
    }>
    non_subscriptions: Record<string, any>
    management_url: string | null
  }
}

export interface RevenueCatCustomerInfo {
  app_user_id: string
  subscriber: RevenueCatSubscriber['subscriber']
}

export interface SubscriptionStatus {
  isActive: boolean
  tier: 'free' | 'pro' | 'elite'
  expiresAt: string | null
  isTrialActive: boolean
  productIdentifier: string | null
  store: string | null
  purchaseDate: string | null
  renewalStatus: 'active' | 'cancelled' | 'expired' | 'trial'
  productType: 'monthly' | 'weekly' | 'yearly' | 'lifetime' | 'day_pass' | 'unknown'
}

export interface OverviewMetrics {
  active_subscriptions: number
  active_trials: number
  mrr: number
  revenue: number
  new_customers: number
  active_users: number
  conversion_rate: number
  churn_rate: number
  updated_at: string
}

export interface ProductMetrics {
  product_id: string
  subscribers: number
  revenue: number
  conversions: number
  trials: number
}

export interface RevenueData {
  date: string
  revenue: number
  subscriptions: number
  trials: number
}

class RevenueCatAPI {
  private apiKey: string
  private baseUrl = 'https://api.revenuecat.com/v2'

  // Comprehensive product mapping for all 8 product types
  private readonly PRODUCT_MAPPING = {
    // Monthly products
    'monthly_pro': { tier: 'pro', type: 'monthly' },
    'pro_monthly': { tier: 'pro', type: 'monthly' },
    'monthly_elite': { tier: 'elite', type: 'monthly' },
    'elite_monthly': { tier: 'elite', type: 'monthly' },
    
    // Weekly products  
    'weekly_pro': { tier: 'pro', type: 'weekly' },
    'pro_weekly': { tier: 'pro', type: 'weekly' },
    'weekly_elite': { tier: 'elite', type: 'weekly' },
    'elite_weekly': { tier: 'elite', type: 'weekly' },
    
    // Yearly products
    'yearly_pro': { tier: 'pro', type: 'yearly' },
    'pro_yearly': { tier: 'pro', type: 'yearly' },
    'yearly_elite': { tier: 'elite', type: 'yearly' },
    'elite_yearly': { tier: 'elite', type: 'yearly' },
    
    // Lifetime products
    'lifetime_pro': { tier: 'pro', type: 'lifetime' },
    'pro_lifetime': { tier: 'pro', type: 'lifetime' },
    
    // Day pass products
    'day_pass_pro': { tier: 'pro', type: 'day_pass' },
    'pro_day_pass': { tier: 'pro', type: 'day_pass' },
    'daypass_pro': { tier: 'pro', type: 'day_pass' },
    'pro_daypass': { tier: 'pro', type: 'day_pass' },
  }

  constructor() {
    this.apiKey = process.env.NEXT_PUBLIC_REVENUECAT_API_KEY || ''
    if (!this.apiKey) {
      console.warn('RevenueCat API key not found. Set NEXT_PUBLIC_REVENUECAT_API_KEY environment variable.')
    }
  }

  private async makeRequest(endpoint: string, options: RequestInit = {}) {
    if (!this.apiKey) {
      throw new Error('RevenueCat API key not configured')
    }

    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      ...options,
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
        ...options.headers,
      },
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`RevenueCat API error: ${response.status} ${response.statusText} - ${errorText}`)
    }

    return response.json()
  }

  async getSubscriber(appUserId: string): Promise<RevenueCatCustomerInfo | null> {
    try {
      const data = await this.makeRequest(`/subscribers/${encodeURIComponent(appUserId)}`)
      return data
    } catch (error) {
      console.error(`Error fetching RevenueCat subscriber ${appUserId}:`, error)
      return null
    }
  }

  async updateSubscriberAttributes(appUserId: string, attributes: Record<string, any>) {
    try {
      return await this.makeRequest(`/subscribers/${encodeURIComponent(appUserId)}`, {
        method: 'POST',
        body: JSON.stringify({
          attributes
        })
      })
    } catch (error) {
      console.error('Error updating RevenueCat subscriber attributes:', error)
      throw error
    }
  }

  // New methods for comprehensive RevenueCat integration

  // Fetch overview metrics 
  async getOverviewMetrics(): Promise<OverviewMetrics | null> {
    try {
      // Note: API v2 endpoints might be different, using mock data for comprehensive display
      // In real implementation, adjust endpoints based on actual RevenueCat API v2 documentation
      const data = await this.makeRequest('/overview')
      return {
        active_subscriptions: data.active_subscriptions || 0,
        active_trials: data.active_trials || 0,
        mrr: data.mrr || 0,
        revenue: data.revenue || 0,
        new_customers: data.new_customers || 0,
        active_users: data.active_users || 0,
        conversion_rate: data.conversion_rate || 0,
        churn_rate: data.churn_rate || 0,
        updated_at: new Date().toISOString()
      }
    } catch (error) {
      console.error('Error fetching overview metrics:', error)
      return null
    }
  }

  // Fetch product metrics
  async getProductMetrics(): Promise<ProductMetrics[]> {
    try {
      const data = await this.makeRequest('/products/metrics')
      return data.products || []
    } catch (error) {
      console.error('Error fetching product metrics:', error)
      return []
    }
  }

  // Fetch revenue data for charts
  async getRevenueData(days: number = 30): Promise<RevenueData[]> {
    try {
      const endDate = new Date()
      const startDate = new Date(endDate.getTime() - (days * 24 * 60 * 60 * 1000))
      
      const data = await this.makeRequest(`/charts/revenue?start_date=${startDate.toISOString()}&end_date=${endDate.toISOString()}`)
      return data.data || []
    } catch (error) {
      console.error('Error fetching revenue data:', error)
      return []
    }
  }

  // Helper function to determine tier and type from product identifier
  private parseProductInfo(productId: string): { tier: 'free' | 'pro' | 'elite', type: 'monthly' | 'weekly' | 'yearly' | 'lifetime' | 'day_pass' | 'unknown' } {
    const productLower = productId.toLowerCase()
    
    // Check exact mappings first
    for (const [key, info] of Object.entries(this.PRODUCT_MAPPING)) {
      if (productLower.includes(key.toLowerCase())) {
        return info as { tier: 'free' | 'pro' | 'elite', type: 'monthly' | 'weekly' | 'yearly' | 'lifetime' | 'day_pass' | 'unknown' }
      }
    }
    
    // Fallback pattern matching
    let tier: 'free' | 'pro' | 'elite' = 'free'
    let type: 'monthly' | 'weekly' | 'yearly' | 'lifetime' | 'day_pass' | 'unknown' = 'unknown'
    
    // Determine tier
    if (productLower.includes('elite')) {
      tier = 'elite'
    } else if (productLower.includes('pro') || productLower.includes('premium') || productLower.includes('plus')) {
      tier = 'pro'
    }
    
    // Determine type
    if (productLower.includes('month')) {
      type = 'monthly'
    } else if (productLower.includes('week')) {
      type = 'weekly'
    } else if (productLower.includes('year') || productLower.includes('annual')) {
      type = 'yearly'
    } else if (productLower.includes('lifetime') || productLower.includes('forever')) {
      type = 'lifetime'
    } else if (productLower.includes('day') && (productLower.includes('pass') || productLower.includes('daily'))) {
      type = 'day_pass'
    }
    
    return { tier, type }
  }

  // Enhanced helper function to determine subscription status from RevenueCat data
  getSubscriptionStatus(customerInfo: RevenueCatCustomerInfo): SubscriptionStatus {
    const { subscriber } = customerInfo
    const now = new Date()

    // Check entitlements for active subscriptions
    const activeEntitlements = Object.entries(subscriber.entitlements).filter(([_, entitlement]) => {
      if (!entitlement.expires_date) return true // Non-expiring entitlement
      return new Date(entitlement.expires_date) > now
    })

    // Check subscriptions for trial status and additional info
    const activeSubscriptions = Object.entries(subscriber.subscriptions).filter(([_, subscription]) => {
      if (!subscription.expires_date) return false
      return new Date(subscription.expires_date) > now
    })

    const activeTrials = activeSubscriptions.filter(([_, subscription]) => 
      subscription.period_type === 'trial'
    )

    const isActive = activeEntitlements.length > 0
    const isTrialActive = activeTrials.length > 0

    // Initialize return values
    let tier: 'free' | 'pro' | 'elite' = 'free'
    let productType: 'monthly' | 'weekly' | 'yearly' | 'lifetime' | 'day_pass' | 'unknown' = 'unknown'
    let productIdentifier: string | null = null
    let store: string | null = null
    let purchaseDate: string | null = null
    let renewalStatus: 'active' | 'cancelled' | 'expired' | 'trial' = 'expired'

    if (isActive) {
      const activeEntitlement = activeEntitlements[0][1]
      productIdentifier = activeEntitlement.product_identifier
      purchaseDate = activeEntitlement.purchase_date

      // Find the corresponding subscription to get store info
      const subscription = activeSubscriptions.find(([_, sub]) => 
        sub.purchase_date === activeEntitlement.purchase_date || 
        sub.original_purchase_date === activeEntitlement.purchase_date
      )?.[1]
      
      store = subscription?.store || null
      
      // Determine renewal status
      if (isTrialActive) {
        renewalStatus = 'trial'
      } else if (subscription?.unsubscribe_detected_at) {
        renewalStatus = 'cancelled'
      } else {
        renewalStatus = 'active'
      }

      // Parse product info using comprehensive mapping
      const productInfo = this.parseProductInfo(productIdentifier)
      tier = productInfo.tier
      productType = productInfo.type
    }

    // Get the latest expiration date
    const expirationDates = activeEntitlements
      .map(([_, entitlement]) => entitlement.expires_date)
      .filter(date => date !== null)
    
    const expiresAt = expirationDates.length > 0 
      ? expirationDates.reduce((latest, current) => {
          return new Date(current!) > new Date(latest!) ? current : latest
        }) 
      : null

    return {
      isActive,
      tier,
      expiresAt,
      isTrialActive,
      productIdentifier,
      store,
      purchaseDate,
      renewalStatus,
      productType
    }
  }

  // Check if API key is configured
  isConfigured(): boolean {
    return !!this.apiKey
  }

  // Enhanced batch fetch multiple subscribers with comprehensive status
  async getBatchSubscribers(appUserIds: string[]): Promise<Map<string, SubscriptionStatus>> {
    const results = new Map<string, SubscriptionStatus>()
    
    console.log(`🔄 Fetching RevenueCat data for ${appUserIds.length} users with comprehensive product mapping...`)
    
    // Process in smaller batches to avoid rate limiting
    const batchSize = 8
    let processedCount = 0
    
    for (let i = 0; i < appUserIds.length; i += batchSize) {
      const batch = appUserIds.slice(i, i + batchSize)
      
      const promises = batch.map(async (userId) => {
        try {
          const customerInfo = await this.getSubscriber(userId)
          if (customerInfo) {
            const status = this.getSubscriptionStatus(customerInfo)
            results.set(userId, status)
            
            if (status.isActive) {
              console.log(`✅ Found active ${status.tier} ${status.productType} subscription for user ${userId.substring(0, 8)}...`)
            }
          } else {
            // Default status for users not found in RevenueCat
            results.set(userId, {
              isActive: false,
              tier: 'free',
              expiresAt: null,
              isTrialActive: false,
              productIdentifier: null,
              store: null,
              purchaseDate: null,
              renewalStatus: 'expired',
              productType: 'unknown'
            })
          }
        } catch (error) {
          console.error(`❌ Error fetching subscriber ${userId}:`, error)
          results.set(userId, {
            isActive: false,
            tier: 'free',
            expiresAt: null,
            isTrialActive: false,
            productIdentifier: null,
            store: null,
            purchaseDate: null,
            renewalStatus: 'expired',
            productType: 'unknown'
          })
        }
      })

      await Promise.all(promises)
      processedCount += batch.length
      
      console.log(`📊 Processed ${processedCount}/${appUserIds.length} users...`)
      
      // Small delay between batches to be respectful to the API
      if (i + batchSize < appUserIds.length) {
        await new Promise(resolve => setTimeout(resolve, 150))
      }
    }

    const activeSubscribers = Array.from(results.values()).filter(status => status.isActive).length
    console.log(`🎉 Successfully processed ${results.size} users. Found ${activeSubscribers} active subscribers.`)

    return results
  }

  // Advanced methods using read/write permissions

  // Grant promotional entitlement (requires write permission)
  async grantPromoEntitlement(appUserId: string, entitlementId: string, duration?: string): Promise<boolean> {
    try {
      const payload: any = { entitlement_id: entitlementId }
      if (duration) payload.duration = duration
      
      await this.makeRequest(`/subscribers/${encodeURIComponent(appUserId)}/entitlements`, {
        method: 'POST',
        body: JSON.stringify(payload)
      })
      
      console.log(`✅ Granted ${entitlementId} entitlement to user ${appUserId}`)
      return true
    } catch (error) {
      console.error(`❌ Error granting entitlement to ${appUserId}:`, error)
      return false
    }
  }

  // Update subscriber attributes (enhanced)
  async updateSubscriberTier(appUserId: string, tier: 'free' | 'pro' | 'elite'): Promise<boolean> {
    try {
      const attributes = {
        subscription_tier: tier,
        admin_updated: new Date().toISOString(),
        admin_updated_tier: tier
      }
      
      await this.updateSubscriberAttributes(appUserId, attributes)
      console.log(`✅ Updated ${appUserId} to ${tier} tier`)
      return true
    } catch (error) {
      console.error(`❌ Error updating subscriber tier for ${appUserId}:`, error)
      return false
    }
  }

  // Get subscriber purchase history
  async getSubscriberHistory(appUserId: string): Promise<any[]> {
    try {
      const data = await this.makeRequest(`/subscribers/${encodeURIComponent(appUserId)}/history`)
      return data.history || []
    } catch (error) {
      console.error(`❌ Error fetching subscriber history for ${appUserId}:`, error)
      return []
    }
  }

  // Get all products for the app
  async getProducts(): Promise<any[]> {
    try {
      const data = await this.makeRequest('/products')
      return data.products || []
    } catch (error) {
      console.error('❌ Error fetching products:', error)
      return []
    }
  }

  // Refund a purchase (requires write permission)
  async refundPurchase(appUserId: string, purchaseToken: string): Promise<boolean> {
    try {
      await this.makeRequest(`/subscribers/${encodeURIComponent(appUserId)}/purchases/${purchaseToken}/refund`, {
        method: 'POST'
      })
      console.log(`✅ Refunded purchase ${purchaseToken} for user ${appUserId}`)
      return true
    } catch (error) {
      console.error(`❌ Error refunding purchase for ${appUserId}:`, error)
      return false
    }
  }
}

export const revenueCatAPI = new RevenueCatAPI()