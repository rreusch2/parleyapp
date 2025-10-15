import axios from 'axios';
import { supabase } from './supabaseClient';

const API_URL = 'https://zooming-rebirth-production-a305.up.railway.app/api';

const apiClient = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add auth token to requests
apiClient.interceptors.request.use(async (config) => {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.access_token) {
      config.headers.Authorization = `Bearer ${session.access_token}`;
    }
  } catch (error) {
    console.error('Error getting auth session:', error);
  }
  return config;
});

// Handle response errors
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Handle unauthorized error (e.g., redirect to login)
      console.error('Unauthorized request:', error);
      // You can dispatch a logout action or redirect to login here
    }
    return Promise.reject(error);
  }
);

export const predictionsApi = {
  getAll: async (filters?: { sport?: string; status?: string }) => {
    const response = await apiClient.get('/predictions', { params: filters });
    return response.data;
  },

  getById: async (id: string) => {
    const response = await apiClient.get(`/predictions/${id}`);
    return response.data;
  },

  generate: async (data: { event_id: string; sport: string }) => {
    const response = await apiClient.post('/predictions', data);
    return response.data;
  },

  updateStatus: async (id: string, status: 'won' | 'lost') => {
    const response = await apiClient.patch(`/predictions/${id}/status`, { status });
    return response.data;
  },
};

export const userPreferencesApi = {
  get: async () => {
    const response = await apiClient.get('/user-preferences');
    return response.data;
  },

  update: async (preferences: any) => {
    const response = await apiClient.put('/user-preferences', preferences);
    return response.data;
  },
};

export const userApi = {
  deleteAccount: async (userId: string) => {
    const response = await apiClient.delete(`/user/delete-account`, {
      data: { userId }
    });
    return response.data;
  },
  
  updateUserPreferences: async (userId: string, preferences: any) => {
    const response = await apiClient.put('/user/preferences', preferences);
    return response.data;
  },
  
  getUserPreferences: async (userId: string) => {
    const response = await apiClient.get('/user/preferences');
    return response.data;
  },
};

export interface AdminUserSummary {
  id: string;
  username: string | null;
  email: string | null;
  avatar_url: string | null;
  subscription_tier: 'free' | 'pro' | 'elite';
  subscription_plan_type: string | null;
  subscription_status: 'active' | 'inactive' | 'cancelled' | 'expired' | 'past_due' | null;
  subscription_expires_at: string | null;
  created_at: string;
  is_active: boolean;
  welcome_bonus_claimed?: boolean;
  revenuecat_customer_id?: string | null;
  phone_number?: string | null;
}

export const adminApi = {
  listUsers: async (params: {
    page?: number;
    pageSize?: number;
    search?: string;
    tier?: '' | 'free' | 'pro' | 'elite';
    plan?: '' | 'weekly' | 'monthly' | 'yearly' | 'lifetime' | 'admin_manual';
    sortBy?: string; // e.g. 'created_at_desc'
  } = {}) => {
    const response = await apiClient.get('/admin/users', { params });
    return response.data as {
      users: AdminUserSummary[];
      totalCount: number;
      page: number;
      pageSize: number;
      totalPages: number;
    };
  },

  updateUserTier: async (userId: string, tier: 'free' | 'pro' | 'elite') => {
    const response = await apiClient.patch(`/admin/users/${userId}/tier`, { tier });
    return response.data;
  },

  clearPhone: async (userId: string) => {
    const response = await apiClient.patch(`/admin/users/${userId}/clear-phone`);
    return response.data;
  },
};

export const trendsApi = {
  getPlayerProps: async (sport: string, tier: string = 'pro', minStreak?: number) => {
    const params: any = { tier };
    if (minStreak) params.min_streak = minStreak;
    const response = await apiClient.get(`/trends/player-props/${sport}`, { params });
    return response.data;
  },

  getTeamTrends: async (sport: string, tier: string = 'pro', minStreak?: number) => {
    const params: any = { tier };
    if (minStreak) params.min_streak = minStreak;
    const response = await apiClient.get(`/trends/team/${sport}`, { params });
    return response.data;
  },

  getTrendsBySport: async (sport: string, type?: string, tier: string = 'pro') => {
    const params: any = { tier };
    if (type) params.type = type;
    const response = await apiClient.get(`/trends/${sport}`, { params });
    return response.data;
  },

  getOpportunities: async (sport: string, tier: string = 'pro') => {
    const response = await apiClient.get(`/trends/opportunities/${sport}`, { params: { tier } });
    return response.data;
  },

  getSummary: async (sport: string, tier: string = 'pro') => {
    const response = await apiClient.get(`/trends/summary/${sport}`, { params: { tier } });
    return response.data;
  },
};

export default apiClient;