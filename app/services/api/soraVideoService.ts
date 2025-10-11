import { supabase } from './supabaseClient';

const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL || 'https://zooming-rebirth-production-a305.up.railway.app';

export interface VideoGenerationRequest {
  userId: string;
  videoType: 'ai_pick_hype' | 'game_countdown' | 'weekly_recap' | 'player_spotlight' | 'custom';
  title: string;
  description?: string;
  prompt: string;
  metadata?: Record<string, any>;
  relatedPredictionId?: string;
  relatedGameId?: string;
}

export interface GeneratedVideo {
  id: string;
  user_id: string;
  video_type: string;
  title: string;
  description?: string;
  video_url?: string;
  thumbnail_url?: string;
  prompt: string;
  generation_status: 'pending' | 'processing' | 'completed' | 'failed';
  duration_seconds?: number;
  metadata?: Record<string, any>;
  views_count: number;
  downloads_count: number;
  shares_count: number;
  created_at: string;
  updated_at: string;
}

class SoraVideoService {
  /**
   * Generate a new video with Sora 2
   */
  async generateVideo(request: VideoGenerationRequest): Promise<{ id: string; status: string }> {
    try {
      const response = await fetch(`${BACKEND_URL}/api/sora/generate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(request),
      });

      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error || 'Failed to generate video');
      }

      return result.data;
    } catch (error: any) {
      console.error('Error generating video:', error);
      throw error;
    }
  }

  /**
   * Get user's video generation history
   */
  async getUserVideos(userId: string, limit: number = 20): Promise<GeneratedVideo[]> {
    try {
      const { data, error } = await supabase
        .from('user_generated_videos')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) {
        throw error;
      }

      return data || [];
    } catch (error: any) {
      console.error('Error fetching user videos:', error);
      throw error;
    }
  }

  /**
   * Get video by ID with real-time updates
   */
  async getVideoById(videoId: string): Promise<GeneratedVideo | null> {
    try {
      const { data, error } = await supabase
        .from('user_generated_videos')
        .select('*')
        .eq('id', videoId)
        .single();

      if (error) {
        throw error;
      }

      return data;
    } catch (error: any) {
      console.error('Error fetching video:', error);
      return null;
    }
  }

  /**
   * Subscribe to video status updates
   */
  subscribeToVideo(videoId: string, callback: (video: GeneratedVideo) => void): () => void {
    const subscription = supabase
      .channel(`video:${videoId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'user_generated_videos',
          filter: `id=eq.${videoId}`,
        },
        (payload) => {
          callback(payload.new as GeneratedVideo);
        }
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }

  /**
   * Delete a video
   */
  async deleteVideo(videoId: string, userId: string): Promise<void> {
    try {
      const response = await fetch(`${BACKEND_URL}/api/sora/videos/${videoId}?userId=${userId}`, {
        method: 'DELETE',
      });

      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error || 'Failed to delete video');
      }
    } catch (error: any) {
      console.error('Error deleting video:', error);
      throw error;
    }
  }

  /**
   * Generate prompt for AI Pick Hype video
   */
  static buildAIPickHypePrompt(pick: any): string {
    return `Create a dramatic 8-second sports highlight video for ${pick.sport}. 
Show a professional stadium atmosphere with ${pick.match_teams || pick.match}, 
cinematic camera angles, dynamic lighting, and intense crowd energy. 
The video should feel like a major sports broadcast moment with epic music. 
Focus on the excitement of the matchup: ${pick.pick}. 
Make it look like a championship-level game with high production value.`;
  }

  /**
   * Generate prompt for Game Countdown video
   */
  static buildGameCountdownPrompt(game: any): string {
    return `Create a 15-second cinematic countdown video for ${game.sport} game between ${game.home_team} and ${game.away_team}. 
Show the city skyline at sunset, stadium exterior lit up at night, fans arriving with team jerseys, 
dramatic music building tension. End with an epic reveal of the matchup. 
Professional broadcast quality with dynamic camera movements.`;
  }

  /**
   * Generate prompt for Weekly Recap video
   */
  static buildWeeklyRecapPrompt(stats: { wins: number; winRate: number }): string {
    return `Create a 25-second highlight reel showing celebration and victory moments. 
Show confetti falling, trophy lifting, cheering crowds, fireworks, and victory celebrations. 
Overlay text showing ${stats.wins} wins this week with a ${stats.winRate}% success rate. 
Epic music, fast-paced editing, professional sports production quality. 
Make it feel like a championship moment.`;
  }

  /**
   * Get video type display information
   */
  static getVideoTypeInfo(videoType: string) {
    const types: Record<string, { title: string; description: string; tier: string; emoji: string }> = {
      ai_pick_hype: {
        title: 'AI Pick Hype',
        description: 'Dramatic video of your best AI pick',
        tier: 'free',
        emoji: '🔥',
      },
      game_countdown: {
        title: 'Game Countdown',
        description: 'Epic countdown to game time',
        tier: 'pro',
        emoji: '⏰',
      },
      weekly_recap: {
        title: 'Weekly Recap',
        description: 'Celebration of your weekly wins',
        tier: 'elite',
        emoji: '🏆',
      },
      player_spotlight: {
        title: 'Player Spotlight',
        description: 'Highlight reel of player performance',
        tier: 'pro',
        emoji: '⭐',
      },
      custom: {
        title: 'Custom Video',
        description: 'Create your own custom video',
        tier: 'elite',
        emoji: '🎬',
      },
    };

    return types[videoType] || types.ai_pick_hype;
  }
}

export default new SoraVideoService();

