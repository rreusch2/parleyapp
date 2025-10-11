import express from 'express';
import soraVideoService from '../../services/soraVideoService';
import { logger } from '../../utils/logger';
import { supabase } from '../../services/supabaseClient';

const router = express.Router();

/**
 * POST /api/sora/generate
 * Generate a new video with Sora 2
 */
router.post('/generate', async (req, res) => {
  try {
    const {
      userId,
      videoType,
      title,
      description,
      prompt,
      metadata,
      relatedPredictionId,
      relatedGameId,
    } = req.body;

    // Validate required fields
    if (!userId || !videoType || !title || !prompt) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: userId, videoType, title, prompt',
      });
    }

    // Get user's subscription tier
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('subscription_tier, day_pass_tier, day_pass_expires_at')
      .eq('id', userId)
      .single();

    if (profileError || !profile) {
      return res.status(404).json({
        success: false,
        error: 'User profile not found',
      });
    }

    // Determine effective tier
    let effectiveTier: 'free' | 'pro' | 'elite' = profile.subscription_tier || 'free';
    
    // Check day pass
    if (profile.day_pass_tier && profile.day_pass_expires_at) {
      const dayPassExpiry = new Date(profile.day_pass_expires_at);
      if (dayPassExpiry > new Date()) {
        effectiveTier = profile.day_pass_tier as 'pro' | 'elite';
      }
    }

    // Check generation limits
    const canGenerate = await soraVideoService.checkGenerationLimit(userId, effectiveTier);
    if (!canGenerate) {
      return res.status(429).json({
        success: false,
        error: 'Daily video generation limit reached',
        upgradeRequired: effectiveTier === 'free',
      });
    }

    // Enforce video type restrictions by tier
    const tierRestrictions: Record<string, string[]> = {
      free: ['ai_pick_hype'],
      pro: ['ai_pick_hype', 'game_countdown', 'player_spotlight'],
      elite: ['ai_pick_hype', 'game_countdown', 'weekly_recap', 'player_spotlight', 'custom'],
    };

    if (!tierRestrictions[effectiveTier].includes(videoType)) {
      return res.status(403).json({
        success: false,
        error: `Video type "${videoType}" requires ${videoType === 'weekly_recap' ? 'Elite' : 'Pro'} subscription`,
        upgradeRequired: true,
      });
    }

    // Generate video
    const result = await soraVideoService.generateVideo({
      userId,
      videoType,
      title,
      description,
      prompt,
      metadata,
      relatedPredictionId,
      relatedGameId,
    });

    res.json({
      success: true,
      data: result,
    });
  } catch (error: any) {
    logger.error(`Error generating video: ${error.message}`);
    res.status(500).json({
      success: false,
      error: 'Failed to generate video',
      details: error.message,
    });
  }
});

/**
 * GET /api/sora/videos
 * Get user's video generation history
 */
router.get('/videos', async (req, res) => {
  try {
    const { userId, limit = 20 } = req.query;

    if (!userId) {
      return res.status(400).json({
        success: false,
        error: 'Missing required parameter: userId',
      });
    }

    const videos = await soraVideoService.getUserVideos(
      userId as string,
      parseInt(limit as string)
    );

    res.json({
      success: true,
      data: videos,
    });
  } catch (error: any) {
    logger.error(`Error fetching videos: ${error.message}`);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch videos',
      details: error.message,
    });
  }
});

/**
 * GET /api/sora/videos/:videoId
 * Get specific video by ID
 */
router.get('/videos/:videoId', async (req, res) => {
  try {
    const { videoId } = req.params;
    const { userId } = req.query;

    if (!userId) {
      return res.status(400).json({
        success: false,
        error: 'Missing required parameter: userId',
      });
    }

    const video = await soraVideoService.getVideoById(videoId, userId as string);

    // Increment view count
    await soraVideoService.incrementVideoViews(videoId);

    res.json({
      success: true,
      data: video,
    });
  } catch (error: any) {
    logger.error(`Error fetching video: ${error.message}`);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch video',
      details: error.message,
    });
  }
});

/**
 * DELETE /api/sora/videos/:videoId
 * Delete a video
 */
router.delete('/videos/:videoId', async (req, res) => {
  try {
    const { videoId } = req.params;
    const { userId } = req.query;

    if (!userId) {
      return res.status(400).json({
        success: false,
        error: 'Missing required parameter: userId',
      });
    }

    await soraVideoService.deleteVideo(videoId, userId as string);

    res.json({
      success: true,
      message: 'Video deleted successfully',
    });
  } catch (error: any) {
    logger.error(`Error deleting video: ${error.message}`);
    res.status(500).json({
      success: false,
      error: 'Failed to delete video',
      details: error.message,
    });
  }
});

/**
 * POST /api/sora/prompts/ai-pick
 * Generate optimized prompt for AI Pick Hype video
 */
router.post('/prompts/ai-pick', async (req, res) => {
  try {
    const { pick } = req.body;

    if (!pick) {
      return res.status(400).json({
        success: false,
        error: 'Missing required field: pick',
      });
    }

    const prompt = soraVideoService.constructor.buildAIPickHypePrompt(pick);

    res.json({
      success: true,
      prompt,
    });
  } catch (error: any) {
    logger.error(`Error generating prompt: ${error.message}`);
    res.status(500).json({
      success: false,
      error: 'Failed to generate prompt',
      details: error.message,
    });
  }
});

/**
 * POST /api/sora/prompts/game-countdown
 * Generate optimized prompt for Game Countdown video
 */
router.post('/prompts/game-countdown', async (req, res) => {
  try {
    const { game } = req.body;

    if (!game) {
      return res.status(400).json({
        success: false,
        error: 'Missing required field: game',
      });
    }

    const prompt = soraVideoService.constructor.buildGameCountdownPrompt(game);

    res.json({
      success: true,
      prompt,
    });
  } catch (error: any) {
    logger.error(`Error generating prompt: ${error.message}`);
    res.status(500).json({
      success: false,
      error: 'Failed to generate prompt',
      details: error.message,
    });
  }
});

/**
 * POST /api/sora/prompts/weekly-recap
 * Generate optimized prompt for Weekly Recap video
 */
router.post('/prompts/weekly-recap', async (req, res) => {
  try {
    const { stats } = req.body;

    if (!stats) {
      return res.status(400).json({
        success: false,
        error: 'Missing required field: stats',
      });
    }

    const prompt = soraVideoService.constructor.buildWeeklyRecapPrompt(stats);

    res.json({
      success: true,
      prompt,
    });
  } catch (error: any) {
    logger.error(`Error generating prompt: ${error.message}`);
    res.status(500).json({
      success: false,
      error: 'Failed to generate prompt',
      details: error.message,
    });
  }
});

export default router;

