import axios from 'axios';
import type { SportsEvent, GetGamesParams } from '@/app/types/sports';
import { supabase } from './supabaseClient';

// Use environment variable with fallback to local IP for mobile access
const API_BASE_URL = 'https://zooming-rebirth-production-a305.up.railway.app/api';

export { type SportsEvent, type GetGamesParams };

interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
}

class SportsApi {
  private api = axios.create({
    baseURL: API_BASE_URL,
    headers: {
      'Content-Type': 'application/json',
    },
    timeout: 10000, // 10 second timeout
    timeoutErrorMessage: 'Request timed out - please try again',
    withCredentials: true // Important for CORS with credentials
  });

  private async getAuthHeader() {
    const { data: { session } } = await supabase.auth.getSession();
    return session?.access_token ? {
      'Authorization': `Bearer ${session.access_token}`
    } : {};
  }

  async getGames(params?: GetGamesParams) {
    try {
      const headers = await this.getAuthHeader();
      console.log('Making request to:', `${API_BASE_URL}/sports-events`);
      console.log('With headers:', headers);
      
      // Ensure league parameter is uppercase for consistency
      const modifiedParams = params ? {
        ...params,
        league: params.league?.toUpperCase()
      } : undefined;

      console.log('Request params:', modifiedParams);

      const response = await this.api.get<PaginatedResponse<SportsEvent>>('/sports-events', { 
        params: modifiedParams,
        headers,
        validateStatus: (status) => status < 500 // Accept all responses < 500
      });
      console.log('Response:', response.data);
      return response;
    } catch (error: any) {
      console.error('Error fetching games:', error);
      if (error.response) {
        // The request was made and the server responded with a status code
        // that falls out of the range of 2xx
        console.error('Response data:', error.response.data);
        console.error('Response status:', error.response.status);
        console.error('Response headers:', error.response.headers);
      } else if (error.request) {
        // The request was made but no response was received
        console.error('No response received:', error.request);
      } else {
        // Something happened in setting up the request that triggered an Error
        console.error('Error setting up request:', error.message);
      }
      throw error;
    }
  }

  async getUpcomingGames(params?: GetGamesParams) {
    try {
      const headers = await this.getAuthHeader();
      const response = await this.api.get<PaginatedResponse<SportsEvent>>('/sports-events', { 
        params: { ...params, status: 'scheduled' },
        headers
      });
      return response;
    } catch (error) {
      console.error('Error fetching upcoming games:', error);
      throw error;
    }
  }

  async getLiveGames(params?: GetGamesParams) {
    try {
      const headers = await this.getAuthHeader();
      const response = await this.api.get<PaginatedResponse<SportsEvent>>('/sports-events', { 
        params: { ...params, status: 'live' },
        headers
      });
      return response;
    } catch (error) {
      console.error('Error fetching live games:', error);
      throw error;
    }
  }

  // Get a specific game by ID
  async getGameById(id: string): Promise<SportsEvent> {
    try {
      const headers = await this.getAuthHeader();
      const response = await this.api.get<SportsEvent>(`/sports-events/${id}`, { headers });
      return response.data;
    } catch (error) {
      console.error(`Error fetching game with ID ${id}:`, error);
      throw error;
    }
  }

  // Search for games
  async searchGames(query: string): Promise<SportsEvent[]> {
    try {
      const headers = await this.getAuthHeader();
      const response = await this.api.get<SportsEvent[]>('/sports-events/search', {
        params: { query },
        headers
      });
      return response.data;
    } catch (error) {
      console.error('Error searching games:', error);
      throw error;
    }
  }
}

export const sportsApi = new SportsApi();
export default sportsApi; 