import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { checkAdminAccess } from '@/lib/adminAuth'
import { cookies } from 'next/headers'

// Use service role key for admin operations
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
)

export async function GET(request: NextRequest) {
  try {
    // Get user from session
    const cookieStore = cookies()
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get(name: string) {
            return cookieStore.get(name)?.value
          },
        },
      }
    )

    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check if user is admin using service role (bypass RLS)
    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('admin_role')
      .eq('id', user.id)
      .single()
    
    if (profileError || !profile?.admin_role) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
    }

    // Get query parameters
    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '1')
    const pageSize = parseInt(searchParams.get('pageSize') || '10')
    const statusFilter = searchParams.get('statusFilter') || 'all'
    const categoryFilter = searchParams.get('categoryFilter') || 'all'

    // Build query using service role (bypasses RLS)
    let query = supabaseAdmin
      .from('support_requests')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false })

    if (statusFilter !== 'all') {
      query = query.eq('status', statusFilter)
    }

    if (categoryFilter !== 'all') {
      query = query.eq('category', categoryFilter)
    }

    const from = (page - 1) * pageSize
    const to = from + pageSize - 1
    query = query.range(from, to)

    const { data, error, count } = await query

    if (error) {
      throw error
    }

    return NextResponse.json({
      data: data || [],
      totalPages: Math.ceil((count || 0) / pageSize),
      count: count || 0
    })

  } catch (error) {
    console.error('Error fetching support requests:', error)
    return NextResponse.json(
      { error: 'Failed to fetch support requests' },
      { status: 500 }
    )
  }
}

export async function PATCH(request: NextRequest) {
  try {
    // Get user from session
    const cookieStore = cookies()
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get(name: string) {
            return cookieStore.get(name)?.value
          },
        },
      }
    )

    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check if user is admin using service role (bypass RLS)
    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('admin_role')
      .eq('id', user.id)
      .single()
    
    if (profileError || !profile?.admin_role) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
    }

    const body = await request.json()
    const { id, status } = body

    if (!id || !status) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    // Update using service role (bypasses RLS)
    const { data, error } = await supabaseAdmin
      .from('support_requests')
      .update({ 
        status,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select()

    if (error) {
      throw error
    }

    return NextResponse.json({ data })

  } catch (error) {
    console.error('Error updating support request:', error)
    return NextResponse.json(
      { error: 'Failed to update support request' },
      { status: 500 }
    )
  }
}