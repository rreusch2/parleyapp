import apiClient from './client';

export interface ChatValidationResponse {
  canSendMessage: boolean;
  remainingMessages: number;
  dailyLimit: number;
  currentMessages: number;
  isProUser: boolean;
  nextResetHours: number;
}

export interface ChatIncrementResponse {
  success: boolean;
  newCount: number;
  remainingMessages: number;
}

class ChatService {
  /**
   * Validate if user can send a chat message and get current limits
   */
  async validateMessage(): Promise<ChatValidationResponse> {
    try {
      const response = await apiClient.post('/api/ai/chat/validate-message');
      return response.data;
    } catch (error: any) {
      console.error('Error validating chat message:', error);
      
      // If server error, assume they can send (graceful degradation)
      if (error.response?.status >= 500) {
        return {
          canSendMessage: true,
          remainingMessages: 3,
          dailyLimit: 3,
          currentMessages: 0,
          isProUser: false,
          nextResetHours: 24
        };
      }
      
      // If 401/403, user needs to authenticate or is blocked
      return {
        canSendMessage: false,
        remainingMessages: 0,
        dailyLimit: 3,
        currentMessages: 3,
        isProUser: false,
        nextResetHours: 24
      };
    }
  }

  /**
   * Increment user's daily chat message count after successful send
   */
  async incrementMessage(): Promise<ChatIncrementResponse> {
    try {
      const response = await apiClient.post('/api/ai/chat/increment-message');
      return response.data;
    } catch (error: any) {
      console.error('Error incrementing chat message:', error);
      
      // Return error state if limit reached
      if (error.response?.status === 429) {
        return {
          success: false,
          newCount: 3,
          remainingMessages: 0
        };
      }
      
      throw error;
    }
  }

  /**
   * Get chat status without making changes (useful for UI updates)
   */
  async getChatStatus(): Promise<ChatValidationResponse> {
    return this.validateMessage();
  }
}

export const chatService = new ChatService();
export default chatService;
