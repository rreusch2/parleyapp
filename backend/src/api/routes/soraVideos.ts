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
 * POST /api/sora/generate-bet-video
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
        const picksText = picks.slice(0, 3).map((p, i) => 
          `${i + 1}. ${p.match_teams}: ${p.pick} @ ${p.odds}`
        ).join(', ');

        const parlayOdds = picks.length > 1 
          ? picks.reduce((acc, p) => {
              const oddsStr = String(p.odds).replace(/[^0-9.-]/g, '');
              const odds = parseFloat(oddsStr);
              if (isNaN(odds)) return acc;
              const decimal = odds > 0 ? (odds / 100) + 1 : (100 / Math.abs(odds)) + 1;
              return acc * decimal;
            }, 1)
          : null;

        const potentialPayout = parlayOdds && parlayOdds > 1
          ? `+${Math.round((parlayOdds - 1) * 100)}`
          : picks[0].odds;

        generatedPrompt = `Epic sports betting highlight montage: A cinematic betting slip floating in space showing ${picks.length} ${picks.length > 1 ? 'pick parlay' : 'pick'} - ${picksText}. Dramatic ${picks[0].sport || 'sports'} stadium atmosphere with crowd energy, cash and gold coins flying through the air, electric blue and gold particle effects, professional sports broadcast quality, high-energy celebration vibes, potential payout ${potentialPayout} highlighted in bold glowing text, confetti and fireworks. 5 seconds, portrait orientation 720x1280, cinematic lighting.`;
      }
    } else if (promptType === 'daily_briefing') {
      // Daily briefing video
      generatedPrompt = `A confident professional sports analyst in a sleek modern broadcast studio presenting today's top betting picks, holographic displays showing live game stats and odds floating around, dramatic LED wall backgrounds with sports highlights, professional ESPN-style production quality, dynamic camera movements, cinematic lighting, 5 seconds, portrait 720x1280.`;
      
    } else if (promptType === 'pick_explainer' && pickIds && pickIds.length > 0) {
      const { data: picks } = await supabaseAdmin
        .from('ai_predictions')
        .select('*')
        .in('id', pickIds)
        .limit(1);
      
      if (picks && picks[0]) {
        const pick = picks[0];
        generatedPrompt = `Sports analytics breakdown: Visual explanation of why ${pick.match_teams} ${pick.pick} is a value bet at ${pick.odds}, showing ${pick.confidence}% confidence with animated statistics and trend graphs, professional analyst presentation style, clean modern graphics, 5 seconds, portrait 720x1280.`;
      }
      
    } else if (promptType === 'custom' && customPrompt) {
      generatedPrompt = customPrompt + ' 5 seconds, portrait orientation 720x1280, high quality.';
    } else {
      return res.status(400).json({ error: 'Invalid prompt configuration' });
    }

    logger.info(`🎬 Generated prompt (${generatedPrompt.length} chars): ${generatedPrompt.substring(0, 150)}...`);

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
    logger.info(`🚀 Calling Sora 2 API for video generation (model: sora-2)...`);
    
    try {
      // Use the Videos API endpoint for Sora 2
      const videoJob = await fetch('https://api.openai.com/v1/videos/generations', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'sora-2',
          prompt: generatedPrompt,
          duration,
          size: '720x1280',
        }),
      });

      if (!videoJob.ok) {
        const errorData = await videoJob.json();
        throw new Error(errorData.error?.message || 'Sora 2 API error');
      }

      const jobData = await videoJob.json();
      const jobId = jobData.id;

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
        estimatedTime: duration * 3, // Rough estimate (3x video length)
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
 * GET /api/sora/video-status/:videoId
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
        const statusResponse = await fetch(
          `https://api.openai.com/v1/videos/generations/${videoRecord.openai_job_id}`,
          {
            headers: {
              'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
            },
          }
        );

        if (statusResponse.ok) {
          const jobStatus = await statusResponse.json();
          
          if (jobStatus.status === 'succeeded' && jobStatus.output?.url) {
            const videoUrl = jobStatus.output.url;
            
            // Download video and upload to Supabase Storage
            logger.info(`📥 Downloading video from OpenAI CDN...`);
            const videoResponse = await fetch(videoUrl);
            const videoBuffer = await videoResponse.arrayBuffer();
            const fileName = `videos/${userId}/${videoId}.mp4`;
            
            logger.info(`⬆️ Uploading to Supabase Storage: ${fileName}`);
            const { error: uploadError } = await supabaseAdmin.storage
              .from('generated-videos')
              .upload(fileName, videoBuffer, {
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

            logger.info(`✅ Video completed and stored: ${publicUrlData.publicUrl}`);

            videoRecord.generation_status = 'completed';
            videoRecord.video_url = publicUrlData.publicUrl;
            videoRecord.completed_at = new Date().toISOString();

          } else if (jobStatus.status === 'failed') {
            logger.error(`❌ Sora 2 job failed: ${jobStatus.error}`);
            await supabaseAdmin
              .from('user_generated_videos')
              .update({
                generation_status: 'failed',
                error_message: jobStatus.error || 'Generation failed',
              })
              .eq('id', videoId);

            videoRecord.generation_status = 'failed';
          }
        }

      } catch (pollError: any) {
        logger.warn(`⚠️ Polling error for job ${videoRecord.openai_job_id}: ${pollError.message}`);
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
      viewsCount: videoRecord.views_count,
      downloadsCount: videoRecord.downloads_count,
      sharesCount: videoRecord.shares_count,
    });

  } catch (error: any) {
    logger.error(`❌ Error checking video status: ${error.message}`);
    res.status(500).json({ error: 'Failed to check video status' });
  }
});

/**
 * GET /api/sora/my-videos
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
    logger.error(`❌ Error fetching user videos: ${error.message}`);
    res.status(500).json({ error: 'Failed to fetch videos' });
  }
});

/**
 * DELETE /api/sora/video/:videoId
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
      .eq('id', videoId)
      .eq('user_id', userId);

    logger.info(`🗑️ Video deleted: ${videoId}`);

    res.json({ success: true, message: 'Video deleted successfully' });

  } catch (error: any) {
    logger.error(`❌ Error deleting video: ${error.message}`);
    res.status(500).json({ error: 'Failed to delete video' });
  }
});

/**
 * POST /api/sora/video/:videoId/increment-views
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
    logger.error(`❌ Error incrementing views: ${error.message}`);
    res.status(500).json({ error: 'Failed to increment views' });
  }
});

/**
 * POST /api/sora/video/:videoId/increment-downloads
 * Increment video download count
 */
router.post('/video/:videoId/increment-downloads', async (req: Request, res: Response) => {
  try {
    const { videoId } = req.params;

    const { error } = await supabaseAdmin.rpc('increment_video_downloads', {
      video_id: videoId,
    });

    if (error) throw error;

    res.json({ success: true });

  } catch (error: any) {
    logger.error(`❌ Error incrementing downloads: ${error.message}`);
    res.status(500).json({ error: 'Failed to increment downloads' });
  }
});

/**
 * POST /api/sora/video/:videoId/increment-shares
 * Increment video share count
 */
router.post('/video/:videoId/increment-shares', async (req: Request, res: Response) => {
  try {
    const { videoId } = req.params;

    const { error } = await supabaseAdmin.rpc('increment_video_shares', {
      video_id: videoId,
    });

    if (error) throw error;

    res.json({ success: true });

  } catch (error: any) {
    logger.error(`❌ Error incrementing shares: ${error.message}`);
    res.status(500).json({ error: 'Failed to increment shares' });
  }
});

/**
 * GET /api/sora/video-usage
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
    logger.error(`❌ Error fetching video usage: ${error.message}`);
    res.status(500).json({ error: 'Failed to fetch usage' });
  }
});

export default router;
