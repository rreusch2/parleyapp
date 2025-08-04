import axios from 'axios';
import { getStorageItem } from '../storage';

const API_URL = 'https://zooming-rebirth-production-a305.up.railway.app/api';

const apiClient = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add auth token to requests
apiClient.interceptors.request.use(async (config) => {
  const token = await getStorageItem('authToken');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
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