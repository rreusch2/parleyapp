import express, { Request, Response } from 'express';
import OpenAI from 'openai';
import { supabaseAdmin } from '../../services/supabase/client';
import { createLogger } from '../../utils/logger';
import { authenticate } from '../../middleware/authenticate';

const router = express.Router();
const logger = createLogger('soraVideos');

// Initialize OpenAI client for Sora 2
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Tier limits for video generation
const TIER_LIMITS = {
  free: 1,
  pro: 5,
  elite: 999, // Unlimited
};

interface GenerateVideoRequest extends Request {
  body: {
    promptType: 'bet_slip_hype' | 'pick_explainer' | 'daily_briefing' | 'custom';
    pickIds?: string[]; // Array of prediction IDs to include
    customPrompt?: string;
    duration?: number; // 5 or 10 seconds
  };
  userId?: string;
}

/**
 * POST /api/ai/generate-bet-video
 * Generate a Sora 2 video for user's betting picks
 */
router.post('/generate-bet-video', authenticate, async (req: GenerateVideoRequest, res: Response) => {
  const startTime = Date.now();
  
  try {
    const userId = req.userId;
    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    const { promptType, pickIds, customPrompt, duration = 5 } = req.body;

    logger.info(`📹 Video generation request from user ${userId}: ${promptType}`);

    // Step 1: Check user's subscription tier and usage limits
    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('subscription_tier')
      .eq('id', userId)
      .single();

    if (profileError || !profile) {
      return res.status(404).json({ error: 'User profile not found' });
    }

    const tier = (profile.subscription_tier || 'free') as 'free' | 'pro' | 'elite';
    const dailyLimit = TIER_LIMITS[tier];

    // Check today's usage
    const today = new Date().toISOString().split('T')[0];
    const { data: usage } = await supabaseAdmin
      .from('video_generation_usage')
      .select('videos_generated')
      .eq('user_id', userId)
      .eq('usage_date', today)
      .single();

    const currentUsage = usage?.videos_generated || 0;

    if (currentUsage >= dailyLimit) {
      return res.status(429).json({
        error: 'Daily video limit reached',
        limit: dailyLimit,
        used: currentUsage,
        tier,
        upgradeRequired: tier === 'free',
      });
    }

    // Step 2: Fetch betting data for prompt generation
    let betData: any = {};
    let generatedPrompt = '';

    if (promptType === 'bet_slip_hype' && pickIds && pickIds.length > 0) {
      // Fetch the actual picks from database
      const { data: picks } = await supabaseAdmin
        .from('ai_predictions')
        .select('*')
        .in('id', pickIds);

      if (picks && picks.length > 0) {
        betData = {
          picks: picks.map(p => ({
            match: p.match_teams,
            pick: p.pick,
            odds: p.odds,
            confidence: p.confidence,
            sport: p.sport,
          })),
          totalPicks: picks.length,
        };

        // Generate an epic Sora 2 prompt
        const picksText = picks.map((p, i) => 
          `${i + 1}. ${p.match_teams}: ${p.pick} @ ${p.odds}`
        ).join(', ');

        const parlayOdds = picks.length > 1 
          ? picks.reduce((acc, p) => {
              const odds = parseFloat(p.odds);
              const decimal = odds > 0 ? (odds / 100) + 1 : (100 / Math.abs(odds)) + 1;
              return acc * decimal;
            }, 1)
          : null;

        const potentialPayout = parlayOdds 
          ? `+${Math.round((parlayOdds - 1) * 100 * 100) / 100}` 
          : picks[0].odds;

        generatedPrompt = `Epic sports betting highlight montage: A cinematic betting slip floating in space showing ${picks.length} picks${picks.length > 1 ? ' parlay' : ''} - ${picksText}. Dramatic stadium atmosphere, cash and gold coins flying through the air, electric blue and gold particle effects, professional broadcast quality, high-energy celebration vibes, potential payout ${potentialPayout} highlighted in bold glowing text. 5 seconds, portrait orientation 720x1280.`;
      }
    } else if (promptType === 'daily_briefing') {
      // Daily briefing video
      generatedPrompt = `A confident sports analyst in a modern broadcast studio presenting today's top betting picks with holographic displays showing game stats and odds, professional ESPN-style production, dramatic lighting, cinematic camera movements, 5 seconds, portrait 720x1280.`;
      
    } else if (promptType === 'custom' && customPrompt) {
      generatedPrompt = customPrompt;
    } else {
      return res.status(400).json({ error: 'Invalid prompt configuration' });
    }

    logger.info(`🎬 Generated prompt: ${generatedPrompt.substring(0, 100)}...`);

    // Step 3: Create database record
    const { data: videoRecord, error: insertError } = await supabaseAdmin
      .from('user_generated_videos')
      .insert({
        user_id: userId,
        prompt_text: generatedPrompt,
        prompt_type: promptType,
        generation_status: 'pending',
        bet_data: betData,
        duration_seconds: duration,
      })
      .select()
      .single();

    if (insertError || !videoRecord) {
      logger.error(`Failed to create video record: ${insertError}`);
      return res.status(500).json({ error: 'Failed to create video record' });
    }

    // Step 4: Call Sora 2 API
    logger.info(`🚀 Calling Sora 2 API for video generation...`);
    
    try {
      const videoResponse = await openai.chat.completions.create({
        model: 'sora-2',
        messages: [{
          role: 'user',
          content: generatedPrompt,
        }],
        // @ts-ignore - Sora 2 specific parameters
        duration: duration,
        size: '720x1280', // Portrait for mobile
      } as any);

      // Sora 2 returns a job ID for polling
      const jobId = (videoResponse as any).id;

      // Update record with job ID
      await supabaseAdmin
        .from('user_generated_videos')
        .update({
          openai_job_id: jobId,
          generation_status: 'processing',
        })
        .eq('id', videoRecord.id);

      // Update usage count
      await supabaseAdmin
        .from('video_generation_usage')
        .upsert({
          user_id: userId,
          usage_date: today,
          videos_generated: currentUsage + 1,
          subscription_tier: tier,
        });

      logger.info(`✅ Video generation started: ${videoRecord.id}, Job ID: ${jobId}`);

      res.json({
        success: true,
        videoId: videoRecord.id,
        jobId,
        status: 'processing',
        estimatedTime: duration * 2, // Rough estimate
        processingTime: Date.now() - startTime,
      });

    } catch (apiError: any) {
      logger.error(`❌ Sora 2 API error: ${apiError.message}`);
      
      // Update record as failed
      await supabaseAdmin
        .from('user_generated_videos')
        .update({
          generation_status: 'failed',
          error_message: apiError.message,
        })
        .eq('id', videoRecord.id);

      res.status(500).json({
        error: 'Video generation failed',
        details: apiError.message,
      });
    }

  } catch (error: any) {
    logger.error(`❌ Video generation error: ${error.message}`);
    res.status(500).json({ error: 'Internal server error', details: error.message });
  }
});

/**
 * GET /api/ai/video-status/:videoId
 * Poll for video generation status
 */
router.get('/video-status/:videoId', authenticate, async (req: Request, res: Response) => {
  try {
    const { videoId } = req.params;
    const userId = (req as any).userId;

    const { data: videoRecord, error } = await supabaseAdmin
      .from('user_generated_videos')
      .select('*')
      .eq('id', videoId)
      .eq('user_id', userId)
      .single();

    if (error || !videoRecord) {
      return res.status(404).json({ error: 'Video not found' });
    }

    // If still processing, poll OpenAI for status
    if (videoRecord.generation_status === 'processing' && videoRecord.openai_job_id) {
      try {
        const jobStatus = await openai.chat.completions.retrieve(videoRecord.openai_job_id);
        
        if ((jobStatus as any).status === 'succeeded' && (jobStatus as any).output?.url) {
          const videoUrl = (jobStatus as any).output.url;
          
          // Download video and upload to Supabase Storage
          const videoBlob = await fetch(videoUrl).then(r => r.blob());
          const fileName = `videos/${userId}/${videoId}.mp4`;
          
          const { data: uploadData, error: uploadError } = await supabaseAdmin.storage
            .from('generated-videos')
            .upload(fileName, videoBlob, {
              contentType: 'video/mp4',
              upsert: true,
            });

          if (uploadError) {
            throw uploadError;
          }

          // Get public URL
          const { data: publicUrlData } = supabaseAdmin.storage
            .from('generated-videos')
            .getPublicUrl(fileName);

          // Update database record
          await supabaseAdmin
            .from('user_generated_videos')
            .update({
              generation_status: 'completed',
              video_url: publicUrlData.publicUrl,
              video_storage_path: fileName,
              completed_at: new Date().toISOString(),
            })
            .eq('id', videoId);

          videoRecord.generation_status = 'completed';
          videoRecord.video_url = publicUrlData.publicUrl;
          videoRecord.completed_at = new Date().toISOString();

        } else if ((jobStatus as any).status === 'failed') {
          await supabaseAdmin
            .from('user_generated_videos')
            .update({
              generation_status: 'failed',
              error_message: (jobStatus as any).error || 'Generation failed',
            })
            .eq('id', videoId);

          videoRecord.generation_status = 'failed';
        }

      } catch (pollError: any) {
        logger.warn(`Polling error for job ${videoRecord.openai_job_id}: ${pollError.message}`);
      }
    }

    res.json({
      id: videoRecord.id,
      status: videoRecord.generation_status,
      videoUrl: videoRecord.video_url,
      promptType: videoRecord.prompt_type,
      createdAt: videoRecord.created_at,
      completedAt: videoRecord.completed_at,
      error: videoRecord.error_message,
    });

  } catch (error: any) {
    logger.error(`Error checking video status: ${error.message}`);
    res.status(500).json({ error: 'Failed to check video status' });
  }
});

/**
 * GET /api/ai/my-videos
 * Get user's generated videos
 */
router.get('/my-videos', authenticate, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    const { limit = 20, status } = req.query;

    let query = supabaseAdmin
      .from('user_generated_videos')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(parseInt(limit as string));

    if (status) {
      query = query.eq('generation_status', status);
    }

    const { data: videos, error } = await query;

    if (error) {
      throw error;
    }

    res.json({ videos: videos || [], count: videos?.length || 0 });

  } catch (error: any) {
    logger.error(`Error fetching user videos: ${error.message}`);
    res.status(500).json({ error: 'Failed to fetch videos' });
  }
});

/**
 * DELETE /api/ai/video/:videoId
 * Delete a video
 */
router.delete('/video/:videoId', authenticate, async (req: Request, res: Response) => {
  try {
    const { videoId } = req.params;
    const userId = (req as any).userId;

    // Get video record
    const { data: video } = await supabaseAdmin
      .from('user_generated_videos')
      .select('video_storage_path')
      .eq('id', videoId)
      .eq('user_id', userId)
      .single();

    if (!video) {
      return res.status(404).json({ error: 'Video not found' });
    }

    // Delete from storage if exists
    if (video.video_storage_path) {
      await supabaseAdmin.storage
        .from('generated-videos')
        .remove([video.video_storage_path]);
    }

    // Delete database record
    await supabaseAdmin
      .from('user_generated_videos')
      .delete()
      .eq('id', videoId);

    res.json({ success: true, message: 'Video deleted successfully' });

  } catch (error: any) {
    logger.error(`Error deleting video: ${error.message}`);
    res.status(500).json({ error: 'Failed to delete video' });
  }
});

/**
 * POST /api/ai/video/:videoId/increment-views
 * Increment video view count
 */
router.post('/video/:videoId/increment-views', async (req: Request, res: Response) => {
  try {
    const { videoId } = req.params;

    const { error } = await supabaseAdmin.rpc('increment_video_views', {
      video_id: videoId,
    });

    if (error) throw error;

    res.json({ success: true });

  } catch (error: any) {
    logger.error(`Error incrementing views: ${error.message}`);
    res.status(500).json({ error: 'Failed to increment views' });
  }
});

/**
 * GET /api/ai/video-usage
 * Get user's current usage and limits
 */
router.get('/video-usage', authenticate, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;

    // Get user tier
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('subscription_tier')
      .eq('id', userId)
      .single();

    const tier = (profile?.subscription_tier || 'free') as 'free' | 'pro' | 'elite';
    const dailyLimit = TIER_LIMITS[tier];

    // Get today's usage
    const today = new Date().toISOString().split('T')[0];
    const { data: usage } = await supabaseAdmin
      .from('video_generation_usage')
      .select('videos_generated')
      .eq('user_id', userId)
      .eq('usage_date', today)
      .single();

    const used = usage?.videos_generated || 0;
    const remaining = Math.max(0, dailyLimit - used);

    res.json({
      tier,
      dailyLimit,
      used,
      remaining,
      canGenerate: remaining > 0,
    });

  } catch (error: any) {
    logger.error(`Error fetching video usage: ${error.message}`);
    res.status(500).json({ error: 'Failed to fetch usage' });
  }
});

export default router;

