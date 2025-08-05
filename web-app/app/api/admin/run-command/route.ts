import { NextRequest, NextResponse } from 'next/server'
import { checkAdminAccess } from '@/lib/adminAuth'
import { supabase } from '@/shared/services/supabaseClient'

export async function POST(req: NextRequest) {
  try {
    // Extract the request body
    const body = await req.json()
    const { command } = body
    
    if (!command) {
      return NextResponse.json({ success: false, error: 'Command is required' }, { status: 400 })
    }

    // Get the user token from the request
    const authHeader = req.headers.get('authorization')
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ success: false, error: 'Unauthorized - no token' }, { status: 401 })
    }
    
    const token = authHeader.split(' ')[1]
    
    // Verify the user is authenticated
    const { data: { user }, error: authError } = await supabase.auth.getUser(token)
    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized - invalid token' }, { status: 401 })
    }
    
    // Check if the user has admin access
    const hasAccess = await checkAdminAccess(user.id)
    if (!hasAccess) {
      return NextResponse.json({ success: false, error: 'Unauthorized - not an admin' }, { status: 403 })
    }
    
    // Process the command - don't execute locally, send to the backend API
    const backendUrl = process.env.NEXT_PUBLIC_BACKEND_API_URL
    if (!backendUrl) {
      return NextResponse.json({ 
        success: false, 
        error: 'Backend API URL not configured' 
      }, { status: 500 })
    }
    
    // Forward the command to the backend
    const backendResponse = await fetch(`${backendUrl}/api/admin/execute-command`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ command })
    })
    
    const backendData = await backendResponse.json()
    
    if (!backendResponse.ok) {
      return NextResponse.json({ 
        success: false, 
        error: backendData.error || 'Backend command execution failed' 
      }, { status: backendResponse.status })
    }
    
    // Log the command for audit purposes
    await supabase
      .from('admin_logs')
      .insert({
        user_id: user.id,
        command: command,
        executed_at: new Date().toISOString(),
        success: true,
      })
    
    return NextResponse.json({
      success: true,
      message: 'Command executed successfully',
      data: backendData
    })
    
  } catch (error: any) {
    console.error('Error executing admin command:', error)
    return NextResponse.json({ 
      success: false, 
      error: error.message || 'An unexpected error occurred' 
    }, { status: 500 })
  }
}