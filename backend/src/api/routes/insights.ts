import express from 'express';
import { spawn } from 'child_process';
import path from 'path';
import { supabase } from '../../config/supabaseClient';
import { logger } from '../../utils/logger';

const router = express.Router();

// Helper function to extract title from insight text
const extractTitle = (insightText: string): string => {
  if (!insightText) return 'Insight';
  
  // Look for patterns like "Title (Description)" - extract everything before the first opening parenthesis
  const parenMatch = insightText.match(/^([^(]+)\s*\(/);
  if (parenMatch) {
    return parenMatch[1].trim();
  }
  
  // Look for patterns like "Title: Description" - extract everything before the first colon
  const colonMatch = insightText.match(/^([^:]+):/);
  if (colonMatch) {
    return colonMatch[1].trim();
  }
  
  // Look for patterns where the first line or sentence is the title
  const firstLine = insightText.split('\n')[0];
  if (firstLine.length < 100) {
    return firstLine.trim();
  }
  
  // Fallback: use first 60 characters
  return insightText.substring(0, 60).trim() + (insightText.length > 60 ? '...' : '');
};

// Helper function to extract description from insight text
const extractDescription = (insightText: string, title: string): string => {
  if (!insightText) return '';
  
  // If title was extracted from parenthesis pattern, get everything after the opening parenthesis
  const parenMatch = insightText.match(/^[^(]+\s*\((.*)/);
  if (parenMatch) {
    let desc = parenMatch[1];
    // Remove closing parenthesis if it's at the end
    if (desc.endsWith(')')) {
      desc = desc.slice(0, -1);
    }
    return desc.trim();
  }
  
  // If title was extracted from colon pattern, get everything after the colon
  const colonMatch = insightText.match(/^[^:]+:(.*)/);
  if (colonMatch) {
    return colonMatch[1].trim();
  }
  
  // Otherwise, just return the full text
  return insightText;
};

// Helper function to determine category based on insight text
const determineCategory = (insightText: string): string => {
  const text = insightText.toLowerCase();
  
  if (text.includes('weather') || text.includes('rain') || text.includes('wind') || text.includes('temperature')) {
    return 'weather';
  }
  if (text.includes('injur') || text.includes('health') || text.includes('roster') || text.includes('lineup')) {
    return 'injury';
  }
  if (text.includes('pitcher') || text.includes('starting pitcher') || text.includes('era')) {
    return 'pitcher';
  }
  if (text.includes('bullpen') || text.includes('reliever') || text.includes('closer')) {
    return 'bullpen';
  }
  if (text.includes('trend') || text.includes('streak') || text.includes('pattern')) {
    return 'trends';
  }
  if (text.includes('matchup') || text.includes('head-to-head') || text.includes('versus')) {
    return 'matchup';
  }
  if (text.includes('intro') || text.includes('welcome') || text.includes('overview')) {
    return 'intro';
  }
  
  return 'research'; // Default category
};

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
      .order('insight_order', { ascending: true }); // Order by insight_order

    if (error) {
      logger.error('Database error fetching insights:', error);
      return res.status(500).json({
        success: false,
        error: 'Failed to fetch insights from database'
      });
    }

    // Transform the data to match frontend interface
    const transformedInsights: DailyInsight[] = (insights || []).map(insight => {
      // Extract title from insight_text
      const title = insight.title || extractTitle(insight.insight_text);
      
      // Extract description from insight_text based on the extracted title
      const description = insight.description || extractDescription(insight.insight_text, title);
      
      // Determine category based on insight text content
      const category = insight.category || determineCategory(insight.insight_text);
      
      return {
        id: insight.id,
        title: title,
        description: description,
        category: category,
        confidence: insight.confidence || 75,
        impact: insight.impact || 'medium',
        research_sources: insight.research_sources || [],
        created_at: insight.created_at,
        insight_order: insight.insight_order,
        game_info: insight.game_info || null
      };
    });

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

    const scriptPath = path.join(__dirname, '../../../../intelligent_professor_lock_insights.py');
    
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

        // Transform the data using the same logic as the GET endpoint
        const transformedInsights: DailyInsight[] = (newInsights || []).map(insight => {
          // Extract title from insight_text
          const title = insight.title || extractTitle(insight.insight_text);
          
          // Extract description from insight_text based on the extracted title
          const description = insight.description || extractDescription(insight.insight_text, title);
          
          // Determine category based on insight text content
          const category = insight.category || determineCategory(insight.insight_text);
          
          return {
            id: insight.id,
            title: title,
            description: description,
            category: category,
            confidence: insight.confidence || 75,
            impact: insight.impact || 'medium',
            research_sources: insight.research_sources || [],
            created_at: insight.created_at,
            insight_order: insight.insight_order,
            game_info: insight.game_info || null
          };
        });

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