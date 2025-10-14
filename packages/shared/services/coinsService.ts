// Coins and Referral service for web app
// Uses shared apiClient and Supabase auth interceptor
import apiClient from './apiClient'

export interface CoinBalanceResponse {
  balance: number
}

export interface ReferralInfoResponse {
  referral_code?: string
  referred_by?: string | null
}

export interface CoinTransaction {
  id: string
  type: 'earn' | 'spend' | 'bonus' | 'referral'
  amount: number
  description?: string
  created_at: string
}

export const coinsService = {
  async getBalance(): Promise<number> {
    try {
      const { data } = await apiClient.get<CoinBalanceResponse>('/api/coins/balance')
      return data?.balance ?? 0
    } catch (e) {
      console.error('Failed to fetch coin balance', e)
      return 0
    }
  },

  async getTransactions(limit: number = 20): Promise<CoinTransaction[]> {
    try {
      const { data } = await apiClient.get<CoinTransaction[]>(`/api/coins/transactions?limit=${limit}`)
      return data ?? []
    } catch (e) {
      console.error('Failed to fetch coin transactions', e)
      return []
    }
  },

  async getReferralInfo(): Promise<ReferralInfoResponse> {
    try {
      const { data } = await apiClient.get<ReferralInfoResponse>('/api/referrals/me')
      return data ?? {}
    } catch (e) {
      console.error('Failed to fetch referral info', e)
      return {}
    }
  },

  async generateReferralCode(): Promise<string | null> {
    try {
      const { data } = await apiClient.post<{ referral_code: string }>('/api/referrals/generate')
      return data?.referral_code ?? null
    } catch (e) {
      console.error('Failed to generate referral code', e)
      return null
    }
  },

  async claimReferral(code: string): Promise<{ success: boolean; message?: string }> {
    try {
      const { data } = await apiClient.post<{ success: boolean; message?: string }>(
        '/api/referrals/claim',
        { code }
      )
      return data ?? { success: false, message: 'Unknown response' }
    } catch (e: any) {
      const message = e?.response?.data?.message || e?.message || 'Failed to claim referral'
      console.error('Failed to claim referral', e)
      return { success: false, message }
    }
  },
}
