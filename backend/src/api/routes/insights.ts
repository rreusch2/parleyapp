import express from 'express';
import { spawn } from 'child_process';
import path from 'path';
import { supabase } from '../../config/supabaseClient';
import { logger } from '../../utils/logger';

const router = express.Router();

interface DailyInsight {
  id: string;
  title: string;
  description: string;
  category: string;
  confidence: number;
  impact: string;
  research_sources: string[];
  created_at: string;
  insight_order?: number;
  game_info?: {
    home_team: string;
    away_team: string;
    game_time: string;
    odds?: {
      home: number;
      away: number;
    };
  };
}

/**
 * Get existing Daily AI Insights
 */
router.get('/daily-professor-lock', async (req, res) => {
  try {
    logger.info('📊 Fetching Daily AI Insights');

    // Get insights from today (or most recent)
    const today = new Date().toISOString().split('T')[0];
    
    const { data: insights, error } = await supabase
      .from('daily_professor_insights')
      .select('*')
      .gte('created_at', today)
      .order('created_at', { ascending: false })
      .order('insight_order', { ascending: true });

    if (error) {
      logger.error('Database error fetching insights:', error);
      return res.status(500).json({
        success: false,
        error: 'Failed to fetch insights from database'
      });
    }

    // Transform the data to match frontend interface
    const transformedInsights: DailyInsight[] = (insights || []).map(insight => ({
      id: insight.id,
      title: insight.title,
      description: insight.description,
      category: insight.category,
      confidence: insight.confidence || 75,
      impact: insight.impact || 'medium',
      research_sources: insight.research_sources || [],
      created_at: insight.created_at,
      insight_order: insight.insight_order,
      game_info: insight.game_info || null
    }));

    logger.info(`✅ Found ${transformedInsights.length} AI insights`);

    res.json({
      success: true,
      insights: transformedInsights,
      total_insights: transformedInsights.length,
      generated_at: transformedInsights.length > 0 ? transformedInsights[0].created_at : null
    });

  } catch (error) {
    logger.error('Error fetching Daily AI Insights:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch insights'
    });
  }
});

/**
 * Generate new Daily AI Insights
 */
router.post('/generate-daily-professor-lock', async (req, res) => {
  try {
    logger.info('🔄 Generating new Daily AI Insights');

    // Set longer timeout for this operation
    req.setTimeout(120000); // 2 minutes

    const scriptPath = path.join(__dirname, '../../../../enhanced_intelligent_insights.py');
    
    logger.info(`📁 Running Python script: ${scriptPath}`);

    const pythonProcess = spawn('python3', [scriptPath], {
      cwd: path.join(__dirname, '../../../..'),
      env: { ...process.env }
    });

    let scriptOutput = '';
    let scriptError = '';

    pythonProcess.stdout.on('data', (data) => {
      const output = data.toString();
      scriptOutput += output;
      logger.info(`🐍 Python stdout: ${output.trim()}`);
    });

    pythonProcess.stderr.on('data', (data) => {
      const error = data.toString();
      scriptError += error;
      logger.error(`🐍 Python stderr: ${error.trim()}`);
    });

    pythonProcess.on('close', async (code) => {
      logger.info(`🏁 Python script finished with code: ${code}`);

      if (code !== 0) {
        logger.error('Python script failed:', scriptError);
        return res.status(500).json({
          success: false,
          error: 'Failed to generate insights. Please try again.',
          details: scriptError
        });
      }

      try {
        // Fetch the newly generated insights
        const today = new Date().toISOString().split('T')[0];
        
        const { data: newInsights, error } = await supabase
          .from('daily_professor_insights')
          .select('*')
          .gte('created_at', today)
          .order('created_at', { ascending: false })
          .order('insight_order', { ascending: true });

        if (error) {
          logger.error('Database error fetching new insights:', error);
          return res.status(500).json({
            success: false,
            error: 'Generated insights but failed to fetch from database'
          });
        }

        // Transform the data
        const transformedInsights: DailyInsight[] = (newInsights || []).map(insight => ({
          id: insight.id,
          title: insight.title,
          description: insight.description,
          category: insight.category,
          confidence: insight.confidence || 75,
          impact: insight.impact || 'medium',
          research_sources: insight.research_sources || [],
          created_at: insight.created_at,
          insight_order: insight.insight_order,
          game_info: insight.game_info || null
        }));

        logger.info(`✅ Successfully generated ${transformedInsights.length} new insights`);

        res.json({
          success: true,
          insights: transformedInsights,
          total_insights: transformedInsights.length,
          generated_at: new Date().toISOString(),
          script_output: scriptOutput
        });

      } catch (dbError) {
        logger.error('Error fetching generated insights:', dbError);
        res.status(500).json({
          success: false,
          error: 'Insights generated but failed to retrieve'
        });
      }
    });

    pythonProcess.on('error', (error) => {
      logger.error('Failed to start Python process:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to start insight generation process'
      });
    });

  } catch (error) {
    logger.error('Error generating Daily AI Insights:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to generate insights'
    });
  }
});

export default router; 