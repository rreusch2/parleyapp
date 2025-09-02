import express from 'express';
import { supabaseAdmin } from '../../services/supabase/client';
import { exec } from 'child_process';
import { logger } from '../../utils/logger';
import fetch from 'node-fetch';

import { authenticate } from '../../middleware/authenticate';
import { isAdmin } from '../../middleware/isAdmin';

const router = express.Router();

// Admin authentication middleware
router.use(authenticate);
router.use(isAdmin);

// Get dashboard summary statistics
router.get('/stats', async (req: express.Request, res: express.Response) => {
  try {
    // Get all active users with subscription info
    const { data: users, error } = await supabaseAdmin
      .from('profiles')
      .select(`
        id,
        subscription_tier,
        subscription_plan_type,
        subscription_status,
        created_at,
        is_active
      `)
      .eq('is_active', true);

    if (error) {
      console.error('Error fetching users for stats:', error);
      return res.status(500).json({ error: 'Failed to fetch user statistics' });
    }

    // Calculate statistics
    const totalUsers = users.length;
    const proUsers = users.filter(u => u.subscription_tier === 'pro').length;
    const freeUsers = users.filter(u => u.subscription_tier === 'free').length;
    
    // Active subscription counts
    const activeUsers = users.filter(u => u.subscription_status === 'active');
    const weeklySubs = activeUsers.filter(u => u.subscription_plan_type === 'weekly').length;
    const monthlySubs = activeUsers.filter(u => u.subscription_plan_type === 'monthly').length;
    const yearlySubs = activeUsers.filter(u => u.subscription_plan_type === 'yearly').length;
    const lifetimeSubs = activeUsers.filter(u => u.subscription_plan_type === 'lifetime').length;

    // Calculate estimated monthly revenue
    const monthlyRevenue = (
      (weeklySubs * 12.49 * 4.33) + // Weekly * 4.33 weeks per month
      (monthlySubs * 24.99) +
      (yearlySubs * 199.99 / 12) + // Yearly divided by 12 months
      (lifetimeSubs * 349.99 / 60) // Lifetime spread over 5 years (60 months)
    );

    // New users in last 7 days
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const newUsers7d = users.filter(u => new Date(u.created_at) >= sevenDaysAgo).length;

    // Previous 7 days for comparison
    const fourteenDaysAgo = new Date();
    fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14);
    const previousWeekUsers = users.filter(u => {
      const userDate = new Date(u.created_at);
      return userDate >= fourteenDaysAgo && userDate < sevenDaysAgo;
    }).length;

    const userGrowthChange = previousWeekUsers > 0 ? 
      ((newUsers7d - previousWeekUsers) / previousWeekUsers * 100).toFixed(1) : 
      '100';

    res.json({
      totalUsers,
      proUsers,
      freeUsers,
      weeklySubs,
      monthlySubs,
      yearlySubs,
      lifetimeSubs,
      monthlyRevenue: parseFloat(monthlyRevenue.toFixed(2)),
      newUsers7d,
      userGrowthChange: parseFloat(userGrowthChange)
    });

  } catch (error) {
    console.error('Error in admin stats:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});


router.get('/revenuecat-metrics', async (req: express.Request, res: express.Response) => {
  const email = process.env.REVENUECAT_EMAIL;
  const password = process.env.REVENUECAT_PASSWORD;

  if (!email || !password) {
    logger.error('RevenueCat credentials are not set in environment variables.');
    return res.status(500).json({ error: 'Server configuration error: Missing RevenueCat credentials.' });
  }

  const command = `python python-scripts-service/revenuecat_scraper.py`;

  exec(`${command} "${email}" "${password}"`, (error, stdout, stderr) => {
    if (error) {
      logger.error(`Error executing revenuecat_scraper.py: ${stderr}`);
      return res.status(500).json({ error: 'Failed to fetch RevenueCat metrics.', details: stderr });
    }

    try {
      const metrics = JSON.parse(stdout);
      res.json(metrics);
    } catch (parseError) {
      logger.error(`Error parsing JSON from revenuecat_scraper.py: ${parseError}`);
      res.status(500).json({ error: 'Failed to process RevenueCat data.', details: stdout });
    }
  });
});

// Get paginated user list with filters

router.get('/users', async (req: express.Request, res: express.Response) => {
  try {
    const {
      page = '1',
      pageSize = '20',
      search = '',
      tier = '',
      plan = '',
      sortBy = 'created_at_desc'
    } = req.query;

    const pageNum = parseInt(page as string);
    const pageSizeNum = parseInt(pageSize as string);
    const offset = (pageNum - 1) * pageSizeNum;

    // Build query
    let query = supabaseAdmin
      .from('profiles')
      .select(`
        id,
        username,
        email,
        avatar_url,
        subscription_tier,
        subscription_plan_type,
        subscription_status,
        subscription_expires_at,
        created_at,
        is_active,
        welcome_bonus_claimed,
        revenuecat_customer_id
      `, { count: 'exact' });

    // Apply search filter
    if (search) {
      query = query.or(`username.ilike.%${search}%,email.ilike.%${search}%`);
    }

    // Apply tier filter
    if (tier) {
      query = query.eq('subscription_tier', tier);
    }

    // Apply plan filter
    if (plan) {
      query = query.eq('subscription_plan_type', plan);
    }

    // Apply sorting
    const sortByStr = sortBy as string;
    const lastUnderscoreIndex = sortByStr.lastIndexOf('_');
    const sortField = lastUnderscoreIndex > 0 ? sortByStr.substring(0, lastUnderscoreIndex) : 'created_at';
    const sortDirection = lastUnderscoreIndex > 0 ? sortByStr.substring(lastUnderscoreIndex + 1) : 'desc';
    query = query.order(sortField, { ascending: sortDirection === 'asc' });

    // Apply pagination
    query = query.range(offset, offset + pageSizeNum - 1);

    const { data: users, error, count } = await query;

    if (error) {
      console.error('Error fetching users:', error);
      console.error('Query details:', {
        page: pageNum,
        pageSize: pageSizeNum,
        search,
        tier,
        plan,
        sortBy
      });
      return res.status(500).json({ 
        error: 'Failed to fetch users',
        details: error.message 
      });
    }

    res.json({
      users: users || [],
      totalCount: count || 0,
      page: pageNum,
      pageSize: pageSizeNum,
      totalPages: Math.ceil((count || 0) / pageSizeNum)
    });

  } catch (error) {
    console.error('Error in admin users:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get user details by ID
router.get('/users/:userId', async (req: express.Request, res: express.Response) => {
  try {
    const { userId } = req.params;

    const { data: user, error } = await supabaseAdmin
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();

    if (error) {
      console.error('Error fetching user details:', error);
      return res.status(500).json({ error: 'Failed to fetch user details' });
    }

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json(user);

  } catch (error) {
    console.error('Error in admin user details:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get user growth chart data (last 30 days)
router.get('/charts/user-growth', async (req: express.Request, res: express.Response) => {
  try {
    const { data: users, error } = await supabaseAdmin
      .from('profiles')
      .select('created_at')
      .eq('is_active', true)
      .order('created_at', { ascending: true });

    if (error) {
      console.error('Error fetching user growth data:', error);
      return res.status(500).json({ error: 'Failed to fetch user growth data' });
    }

    // Group by day for last 30 days
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const dailyCounts: { [key: string]: number } = {};
    const labels: string[] = [];

    // Initialize all days with 0
    for (let i = 29; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split('T')[0];
      dailyCounts[dateStr] = 0;
      labels.push(date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }));
    }

    // Count users by day
    users.forEach(user => {
      const userDate = new Date(user.created_at);
      if (userDate >= thirtyDaysAgo) {
        const dateStr = userDate.toISOString().split('T')[0];
        if (dailyCounts[dateStr] !== undefined) {
          dailyCounts[dateStr]++;
        }
      }
    });

    const data = Object.values(dailyCounts);

    res.json({
      labels,
      data
    });

  } catch (error) {
    console.error('Error in user growth chart:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get subscription distribution chart data
router.get('/charts/subscription-distribution', async (req: express.Request, res: express.Response) => {
  try {
    const { data: users, error } = await supabaseAdmin
      .from('profiles')
      .select('subscription_tier, subscription_plan_type')
      .eq('is_active', true);

    if (error) {
      console.error('Error fetching subscription data:', error);
      return res.status(500).json({ error: 'Failed to fetch subscription data' });
    }

    const tierCounts = {
      'Free': users.filter(u => u.subscription_tier === 'free').length,
      'Pro': users.filter(u => u.subscription_tier === 'pro').length
    };

    res.json({
      labels: Object.keys(tierCounts),
      data: Object.values(tierCounts)
    });

  } catch (error) {
    console.error('Error in subscription chart:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});


router.post('/execute-command', authenticate, isAdmin, async (req: express.Request, res: express.Response) => {
  const { command } = req.body;
  
  if (!command) {
    return res.status(400).json({ success: false, error: 'Command is required' });
  }
  
  // Whitelist of allowed commands
  const allowedCommands = [
    'python props_enhanced.py',
    'python props_enhanced.py --tomorrow',
    'python teams_enhanced.py',
    'python teams_enhanced.py --tomorrow',
    'npm run odds',
    'python insights_personalized_enhanced.py',
    'python daily_trends_generator.py',
    'python trendsnew.py',
  ];

  if (!allowedCommands.includes(command)) {
    return res.status(403).json({ success: false, error: 'Command not allowed' });
  }

  logger.info(`Received admin command: ${command}`);

  // Handle npm command locally
  if (command === 'cd backend && npm run odds') {
    logger.info('Executing local npm command...');
    exec(command, { cwd: process.cwd() }, (error, stdout, stderr) => {
      if (error) {
        logger.error(`Local command execution error: ${error.message}`);
        return res.status(500).json({ success: false, error: error.message, stderr });
      }
      const output = stdout || stderr;
      logger.info('Local command executed successfully.');
      return res.json({ success: true, output: output.substring(0, 2000) });
    });
  } else {
    // Forward Python scripts to the scripts service
    const scriptsServiceUrl = process.env.PYTHON_SCRIPTS_SERVICE_URL;
    if (!scriptsServiceUrl) {
      logger.error('PYTHON_SCRIPTS_SERVICE_URL is not set.');
      return res.status(500).json({ success: false, error: 'Python scripts service is not configured' });
    }

    logger.info(`Forwarding command to Python Scripts Service: ${scriptsServiceUrl}`);
    try {
      const authHeader = req.headers.authorization;
      if (!authHeader) {
        return res.status(401).json({ success: false, error: 'Unauthorized - no token provided' });
      }

      const serviceResponse = await fetch(`${scriptsServiceUrl}/execute`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': authHeader 
        },
        body: JSON.stringify({ command }),
      });

      const data = await serviceResponse.json();
      
      if (!serviceResponse.ok) {
        logger.error(`Python script execution failed with status ${serviceResponse.status}: ${data.error}`);
        return res.status(serviceResponse.status).json({ success: false, error: data.error || 'Failed to execute script' });
      }

      logger.info('Command forwarded and executed successfully.');
      return res.json({ success: true, output: data.output });

    } catch (error: any) {
      logger.error(`Error forwarding command to scripts service: ${error.message}`);
      return res.status(500).json({ success: false, error: 'Failed to connect to Python scripts service' });
    }
  }
});

// Endpoint to handle App Store Server Notifications
router.post('/apple-server-notifications', async (req: express.Request, res: express.Response) => {
  const notification = req.body;

  try {
    const { data: event, error } = await supabaseAdmin
      .from('webhook_events')
      .insert({
        source: 'apple',
        event_type: notification.notificationType,
        notification_data: notification,
      })
      .select()
      .single();

    if (error) {
      logger.error('Error inserting webhook event:', error);
      return res.status(500).json({ error: 'Failed to store notification' });
    }

    const signedTransactionInfo = notification.data.signedTransactionInfo;
    const decodedTransaction = JSON.parse(Buffer.from(signedTransactionInfo.split('.')[1], 'base64').toString());
    const originalTransactionId = decodedTransaction.originalTransactionId;

    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('id')
      .eq('revenuecat_customer_id', originalTransactionId)
      .single();

    if (profileError || !profile) {
      logger.warn('No profile found for this transaction, skipping profile update.');
    } else {
      let updateData = {};
      switch (notification.notificationType) {
        case 'SUBSCRIBED':
          updateData = {
            subscription_status: 'active',
            subscription_tier: 'pro', 
            subscription_expires_at: new Date(decodedTransaction.expiresDate).toISOString(),
            welcome_bonus_claimed: false,
            welcome_bonus_expires_at: null,
          };
          break;
        case 'DID_RENEW':
          updateData = {
            subscription_status: 'active',
            subscription_expires_at: new Date(decodedTransaction.expiresDate).toISOString(),
          };
          break;
        case 'EXPIRED':
          updateData = {
            subscription_status: 'expired',
          };
          break;
        case 'REVOCATION':
          updateData = {
            subscription_status: 'inactive',
          };
          break;
      }

      if (Object.keys(updateData).length > 0) {
        const { error: updateError } = await supabaseAdmin
          .from('profiles')
          .update(updateData)
          .eq('id', profile.id);

        if (updateError) {
          logger.error('Error updating profile from notification:', updateError);
        }
      }
    }

    res.status(200).send('Notification received');
  } catch (e) {
    logger.error('Error processing notification:', e);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
