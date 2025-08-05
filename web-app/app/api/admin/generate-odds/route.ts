// app/api/admin/generate-odds/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { checkAdminAccess } from '@/lib/adminAuth'
import { supabase } from '@/lib/supabase'

export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization')
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ success: false, error: 'Unauthorized - no token' }, { status: 401 })
    }
    
    const token = authHeader.split(' ')[1]
    const { data: { user }, error: authError } = await supabase.auth.getUser(token)

    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized - invalid token' }, { status: 401 })
    }
    
    const hasAccess = await checkAdminAccess(user.id)
    if (!hasAccess) {
      return NextResponse.json({ success: false, error: 'Unauthorized - not an admin' }, { status: 403 })
    }
    
    const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL
    if (!backendUrl) {
      return NextResponse.json({ 
        success: false, 
        error: 'Backend API URL not configured' 
      }, { status: 500 })
    }
    
    // This is a placeholder for the actual command execution logic.
    // In a real application, you would have a more secure way to run this command.
    const command = 'npm run odds'
    
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
      message: 'Generate Odds command executed successfully',
      data: backendData
    })
    
  } catch (error: any) {
    console.error('Error executing generate odds command:', error)
    return NextResponse.json({ 
      success: false, 
      error: error.message || 'An unexpected error occurred' 
    }, { status: 500 })
  }
}

