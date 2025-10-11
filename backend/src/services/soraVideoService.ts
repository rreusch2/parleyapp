import OpenAI from 'openai';
import { supabase } from './supabaseClient';
import { logger } from '../utils/logger';

interface VideoGenerationRequest {
  userId: string;
  videoType: 'ai_pick_hype' | 'game_countdown' | 'weekly_recap' | 'player_spotlight' | 'custom';
  title: string;
  description?: string;
  prompt: string;
  metadata?: Record<string, any>;
  relatedPredictionId?: string;
  relatedGameId?: string;
}

interface VideoGenerationResponse {
  id: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  videoUrl?: string;
  thumbnailUrl?: string;
  error?: string;
}

class SoraVideoService {
  private openai: OpenAI;
  private maxPollAttempts = 60; // 5 minutes max (5 sec intervals)
  private pollInterval = 5000; // 5 seconds

  constructor() {
    if (!process.env.OPENAI_API_KEY) {
      throw new Error('OPENAI_API_KEY is not configured');
    }
    
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
  }

  /**
   * Initiate video generation with Sora 2
   */
  async generateVideo(request: VideoGenerationRequest): Promise<VideoGenerationResponse> {
    try {
      logger.info(`Starting Sora 2 video generation for user ${request.userId}`);
      
      // Create database record first
      const { data: videoRecord, error: dbError } = await supabase
        .from('user_generated_videos')
        .insert({
          user_id: request.userId,
          video_type: request.videoType,
          title: request.title,
          description: request.description,
          prompt: request.prompt,
          generation_status: 'pending',
          metadata: request.metadata || {},
          related_prediction_id: request.relatedPredictionId,
          related_game_id: request.relatedGameId,
          generation_started_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (dbError || !videoRecord) {
        throw new Error(`Failed to create video record: ${dbError?.message}`);
      }

      // Call OpenAI Sora 2 API
      // Note: Using the video generation endpoint (as of Sora 2 API)
      const videoGeneration = await this.openai.videos.generate({
        model: 'sora-2',
        prompt: request.prompt,
        // Landscape format for sports content
        size: '1280x720',
      });

      // Update record with OpenAI generation ID
      await supabase
        .from('user_generated_videos')
        .update({
          openai_generation_id: videoGeneration.id,
          generation_status: 'processing',
        })
        .eq('id', videoRecord.id);

      // Start polling for completion (async - don't wait)
      this.pollVideoCompletion(videoRecord.id, videoGeneration.id).catch(err => {
        logger.error(`Error polling video completion: ${err.message}`);
      });

      return {
        id: videoRecord.id,
        status: 'processing',
      };
    } catch (error: any) {
      logger.error(`Sora video generation error: ${error.message}`);
      throw error;
    }
  }

  /**
   * Poll for video completion and update database
   */
  private async pollVideoCompletion(videoId: string, openaiGenerationId: string): Promise<void> {
    let attempts = 0;
    
    while (attempts < this.maxPollAttempts) {
      try {
        // Retrieve video generation status
        const videoStatus = await this.openai.videos.retrieve(openaiGenerationId);
        
        if (videoStatus.status === 'completed' && videoStatus.url) {
          logger.info(`Video ${videoId} completed successfully`);
          
          // Download video from OpenAI
          const videoBuffer = await this.downloadVideo(videoStatus.url);
          
          // Upload to Supabase Storage
          const storagePath = `videos/${videoId}.mp4`;
          const { data: uploadData, error: uploadError } = await supabase.storage
            .from('generated-videos')
            .upload(storagePath, videoBuffer, {
              contentType: 'video/mp4',
              cacheControl: '3600',
            });

          if (uploadError) {
            throw new Error(`Failed to upload video: ${uploadError.message}`);
          }

          // Get public URL
          const { data: { publicUrl } } = supabase.storage
            .from('generated-videos')
            .getPublicUrl(storagePath);

          // Generate thumbnail (optional - extract first frame)
          const thumbnailUrl = await this.generateThumbnail(videoBuffer, videoId);

          // Update database record
          await supabase
            .from('user_generated_videos')
            .update({
              generation_status: 'completed',
              video_url: publicUrl,
              thumbnail_url: thumbnailUrl,
              generation_completed_at: new Date().toISOString(),
              duration_seconds: videoStatus.duration || null,
              file_size_bytes: videoBuffer.length,
            })
            .eq('id', videoId);

          return;
        } else if (videoStatus.status === 'failed') {
          logger.error(`Video ${videoId} generation failed`);
          
          await supabase
            .from('user_generated_videos')
            .update({
              generation_status: 'failed',
              generation_completed_at: new Date().toISOString(),
            })
            .eq('id', videoId);

          return;
        }
        
        // Still processing, wait and retry
        attempts++;
        await this.sleep(this.pollInterval);
      } catch (error: any) {
        logger.error(`Error polling video ${videoId}: ${error.message}`);
        attempts++;
        
        if (attempts >= this.maxPollAttempts) {
          // Mark as failed after max attempts
          await supabase
            .from('user_generated_videos')
            .update({
              generation_status: 'failed',
              generation_completed_at: new Date().toISOString(),
            })
            .eq('id', videoId);
        }
        
        await this.sleep(this.pollInterval);
      }
    }
  }

  /**
   * Download video from URL
   */
  private async downloadVideo(url: string): Promise<Buffer> {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to download video: ${response.statusText}`);
    }
    const arrayBuffer = await response.arrayBuffer();
    return Buffer.from(arrayBuffer);
  }

  /**
   * Generate thumbnail from video (simplified - just use first frame placeholder)
   */
  private async generateThumbnail(videoBuffer: Buffer, videoId: string): Promise<string> {
    // TODO: Implement actual thumbnail extraction using ffmpeg or similar
    // For now, return a placeholder or skip
    return `https://via.placeholder.com/1280x720.png?text=Video+${videoId}`;
  }

  /**
   * Get user's video generation history
   */
  async getUserVideos(userId: string, limit: number = 20): Promise<any[]> {
    const { data, error } = await supabase
      .from('user_generated_videos')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      throw new Error(`Failed to fetch user videos: ${error.message}`);
    }

    return data || [];
  }

  /**
   * Get video by ID
   */
  async getVideoById(videoId: string, userId: string): Promise<any> {
    const { data, error } = await supabase
      .from('user_generated_videos')
      .select('*')
      .eq('id', videoId)
      .eq('user_id', userId)
      .single();

    if (error) {
      throw new Error(`Failed to fetch video: ${error.message}`);
    }

    return data;
  }

  /**
   * Increment video view count
   */
  async incrementVideoViews(videoId: string): Promise<void> {
    await supabase.rpc('increment_video_views', { video_id: videoId });
  }

  /**
   * Delete video and associated files
   */
  async deleteVideo(videoId: string, userId: string): Promise<void> {
    // Get video record
    const video = await this.getVideoById(videoId, userId);
    
    // Delete from storage
    if (video.video_url) {
      const storagePath = `videos/${videoId}.mp4`;
      await supabase.storage
        .from('generated-videos')
        .remove([storagePath]);
    }

    // Delete database record
    const { error } = await supabase
      .from('user_generated_videos')
      .delete()
      .eq('id', videoId)
      .eq('user_id', userId);

    if (error) {
      throw new Error(`Failed to delete video: ${error.message}`);
    }
  }

  /**
   * Check user's daily video generation limit based on subscription tier
   */
  async checkGenerationLimit(userId: string, tier: 'free' | 'pro' | 'elite'): Promise<boolean> {
    // Get today's generation count
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const { count, error } = await supabase
      .from('user_generated_videos')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .gte('created_at', today.toISOString());

    if (error) {
      throw new Error(`Failed to check generation limit: ${error.message}`);
    }

    const dailyCount = count || 0;

    // Define limits by tier
    const limits = {
      free: 1, // 1 video per week (enforced elsewhere)
      pro: 3,  // 3 videos per day
      elite: 999, // Unlimited (high number)
    };

    return dailyCount < limits[tier];
  }

  /**
   * Helper: Sleep function
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Build prompt for AI Pick Hype video
   */
  static buildAIPickHypePrompt(pick: any): string {
    return `Create a dramatic 8-second sports highlight video for ${pick.sport}. 
Show a professional stadium atmosphere with ${pick.match_teams}, 
cinematic camera angles, dynamic lighting, and intense crowd energy. 
The video should feel like a major sports broadcast moment with epic music. 
Focus on the excitement of the matchup: ${pick.pick}. 
Make it look like a championship-level game with high production value.`;
  }

  /**
   * Build prompt for Game Countdown video
   */
  static buildGameCountdownPrompt(game: any): string {
    return `Create a 15-second cinematic countdown video for ${game.sport} game between ${game.home_team} and ${game.away_team}. 
Show the city skyline at sunset, stadium exterior lit up at night, fans arriving with team jerseys, 
dramatic music building tension. End with an epic reveal of the matchup. 
Professional broadcast quality with dynamic camera movements.`;
  }

  /**
   * Build prompt for Weekly Recap video
   */
  static buildWeeklyRecapPrompt(stats: any): string {
    return `Create a 25-second highlight reel showing celebration and victory moments. 
Show confetti falling, trophy lifting, cheering crowds, fireworks, and victory celebrations. 
Overlay text showing ${stats.wins} wins this week with a ${stats.winRate}% success rate. 
Epic music, fast-paced editing, professional sports production quality. 
Make it feel like a championship moment.`;
  }
}

export default new SoraVideoService();

