import { Router, Request, Response } from 'express';
import { supabaseAdmin } from '../../services/supabase/client';

const router = Router();

// Admin authentication middleware
const authenticateAdmin = (req: Request, res: Response, next: any) => {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || authHeader !== 'Bearer admin-pplay12345') {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  
  next();
};

// Get dashboard summary statistics
router.get('/stats', authenticateAdmin, async (req: Request, res: Response) => {
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

// Get paginated user list with filters
router.get('/users', authenticateAdmin, async (req: Request, res: Response) => {
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
      `, { count: 'exact' })
      .eq('is_active', true);

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
    const [sortField, sortDirection] = (sortBy as string).split('_');
    query = query.order(sortField, { ascending: sortDirection === 'asc' });

    // Apply pagination
    query = query.range(offset, offset + pageSizeNum - 1);

    const { data: users, error, count } = await query;

    if (error) {
      console.error('Error fetching users:', error);
      return res.status(500).json({ error: 'Failed to fetch users' });
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
router.get('/users/:userId', authenticateAdmin, async (req: Request, res: Response) => {
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
router.get('/charts/user-growth', authenticateAdmin, async (req: Request, res: Response) => {
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
router.get('/charts/subscription-distribution', authenticateAdmin, async (req: Request, res: Response) => {
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

export default router;
