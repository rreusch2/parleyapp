/**
 * 🎥 Video Generation API Routes
 *
 * Handles:
 * - Video generation requests
 * - Video status checking
 * - User video management
 * - Trending/popular videos
 */

import { Request, Response } from 'express';
import { soraVideoGenerationService } from '../../services/soraVideoGenerationService';
import { supabase } from '../../services/supabase/client';
import { createLogger } from '../../utils/logger';

// Helper function to get auth token from request
const getAuthToken = (req: Request): string | null => {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.substring(7);
  }
  return null;
};

// Helper function to verify user from token
const getUserFromToken = async (token: string) => {
  try {
    const { data, error } = await supabase.auth.getUser(token);
    if (error || !data.user) {
      throw new Error('Invalid token');
    }
    return data.user;
  } catch (error) {
    throw new Error('Authentication failed');
  }
};

const logger = createLogger('videosAPI');

interface AuthenticatedRequest extends Request {
  userId?: string;
}

/**
 * Generate a new video using Sora 2
 */
export const generateVideo = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const token = getAuthToken(req);
    if (!token) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const user = await getUserFromToken(token);
    const userId = user.id;

    const { videoType, contentPrompt, sport, gameId, playerId, duration, quality } = req.body;

    // Validate required fields
    if (!videoType || !contentPrompt) {
      return res.status(400).json({
        error: 'Missing required fields: videoType and contentPrompt are required'
      });
    }

    // Validate video type
    const validTypes = ['highlight_reel', 'player_analysis', 'strategy_explanation', 'trend_analysis', 'custom_content'];
    if (!validTypes.includes(videoType)) {
      return res.status(400).json({
        error: `Invalid video type. Must be one of: ${validTypes.join(', ')}`
      });
    }

    // Generate video
    const videoId = await soraVideoGenerationService.generateVideo({
      userId,
      videoType: videoType as any,
      contentPrompt,
      sport,
      gameId,
      playerId,
      duration,
      quality
    });

    logger.info(`✅ Video generation started for user ${userId}: ${videoId}`);

    res.json({
      success: true,
      videoId,
      message: 'Video generation started! Check status for progress updates.'
    });

  } catch (error: any) {
    logger.error(`❌ Error generating video: ${error.message}`);
    res.status(500).json({
      error: error.message || 'Failed to generate video'
    });
  }
};

/**
 * Get video generation status
 */
export const getVideoStatus = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const token = getAuthToken(req);
    if (!token) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const user = await getUserFromToken(token);
    const userId = user.id;
    const { videoId } = req.params;

    if (!userId || !videoId) {
      return res.status(400).json({ error: 'User ID and video ID are required' });
    }

    // Verify user owns the video
    const { data: video, error } = await supabase
      .from('user_generated_videos')
      .select('*')
      .eq('id', videoId)
      .eq('user_id', userId)
      .single();

    if (error || !video) {
      return res.status(404).json({ error: 'Video not found' });
    }

    res.json({
      videoId: video.id,
      status: video.generation_status,
      videoUrl: video.video_url,
      thumbnailUrl: video.thumbnail_url,
      duration: video.video_duration,
      createdAt: video.created_at,
      metadata: video.video_metadata
    });

  } catch (error: any) {
    logger.error(`❌ Error getting video status: ${error.message}`);
    res.status(500).json({ error: 'Failed to get video status' });
  }
};

/**
 * Get user's video history
 */
export const getUserVideos = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const token = getAuthToken(req);
    if (!token) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const user = await getUserFromToken(token);
    const userId = user.id;

    const { limit = 20, offset = 0 } = req.query;
    const videos = await soraVideoGenerationService.getUserVideos(userId, Number(limit));

    res.json({
      videos,
      total: videos.length,
      limit: Number(limit),
      offset: Number(offset)
    });

  } catch (error: any) {
    logger.error(`❌ Error getting user videos: ${error.message}`);
    res.status(500).json({ error: 'Failed to get user videos' });
  }
};

/**
 * Delete a user's video
 */
export const deleteUserVideo = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const token = getAuthToken(req);
    if (!token) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const user = await getUserFromToken(token);
    const userId = user.id;
    const { videoId } = req.params;

    if (!userId || !videoId) {
      return res.status(400).json({ error: 'User ID and video ID are required' });
    }

    const deleted = await soraVideoGenerationService.deleteUserVideo(userId, videoId);

    if (!deleted) {
      return res.status(404).json({ error: 'Video not found or already deleted' });
    }

    res.json({
      success: true,
      message: 'Video deleted successfully'
    });

  } catch (error: any) {
    logger.error(`❌ Error deleting video: ${error.message}`);
    res.status(500).json({ error: 'Failed to delete video' });
  }
};

/**
 * Get trending/popular videos
 */
export const getTrendingVideos = async (req: Request, res: Response) => {
  try {
    const { limit = 10 } = req.query;
    const videos = await soraVideoGenerationService.getTrendingVideos(Number(limit));

    res.json({
      videos,
      total: videos.length
    });

  } catch (error: any) {
    logger.error(`❌ Error getting trending videos: ${error.message}`);
    res.status(500).json({ error: 'Failed to get trending videos' });
  }
};

/**
 * Increment video view count
 */
export const incrementVideoViews = async (req: Request, res: Response) => {
  try {
    const { videoId } = req.params;

    if (!videoId) {
      return res.status(400).json({ error: 'Video ID is required' });
    }

    await soraVideoGenerationService.incrementVideoViews(videoId);

    res.json({
      success: true,
      message: 'View count updated'
    });

  } catch (error: any) {
    logger.error(`❌ Error incrementing video views: ${error.message}`);
    res.status(500).json({ error: 'Failed to update view count' });
  }
};

/**
 * Get video templates
 */
export const getVideoTemplates = async (req: Request, res: Response) => {
  try {
    const { data: templates, error } = await supabase
      .from('video_templates')
      .select('*')
      .order('template_name');

    if (error) {
      throw new Error(`Failed to fetch templates: ${error.message}`);
    }

    res.json({
      templates: templates || []
    });

  } catch (error: any) {
    logger.error(`❌ Error getting video templates: ${error.message}`);
    res.status(500).json({ error: 'Failed to get video templates' });
  }
};

/**
 * Create video using template
 */
export const generateVideoFromTemplate = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.userId;
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const { templateId, customizations } = req.body;

    if (!templateId) {
      return res.status(400).json({ error: 'Template ID is required' });
    }

    // Get template
    const { data: template, error } = await supabase
      .from('video_templates')
      .select('*')
      .eq('id', templateId)
      .single();

    if (error || !template) {
      return res.status(404).json({ error: 'Template not found' });
    }

    // Check if user can use premium templates
    const userLimits = await soraVideoGenerationService['getUserTierLimits'](userId);
    if (template.is_premium && !userLimits.canUsePremiumTemplates) {
      return res.status(403).json({
        error: 'Premium template requires Pro or Elite subscription'
      });
    }

    // Create customized prompt
    let prompt = template.base_prompt;
    if (customizations) {
      // Replace placeholders in prompt
      Object.entries(customizations).forEach(([key, value]) => {
        prompt = prompt.replace(new RegExp(`{{${key}}}`, 'g'), String(value));
      });
    }

    // Generate video
    const videoId = await soraVideoGenerationService.generateVideo({
      userId,
      videoType: template.template_type as any,
      contentPrompt: prompt,
      duration: 60 // Default duration for templates
    });

    res.json({
      success: true,
      videoId,
      template: template.template_name,
      message: 'Video generation started from template!'
    });

  } catch (error: any) {
    logger.error(`❌ Error generating video from template: ${error.message}`);
    res.status(500).json({
      error: error.message || 'Failed to generate video from template'
    });
  }
};
