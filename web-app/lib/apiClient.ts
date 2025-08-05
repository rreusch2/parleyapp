// lib/apiClient.ts
import axios from 'axios';
import { supabase } from './supabase';

const apiClient = axios.create({
  baseURL: '/api', // Base URL for API requests
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add a request interceptor to include the Supabase auth token
apiClient.interceptors.request.use(
  async (config) => {
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.access_token) {
      config.headers.Authorization = `Bearer ${session.access_token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

export default apiClient;
