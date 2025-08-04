import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function GET() {
  try {
    // Test a simple query to the public sports_events table
    const { data, error, status } = await supabase
      .from('sports_events')
      .select('id, sport, home_team, away_team')
      .limit(5);

    if (error) {
      return NextResponse.json({ 
        success: false, 
        message: 'Supabase query failed', 
        error: error.message,
        status
      }, { status: 500 });
    }

    return NextResponse.json({ 
      success: true, 
      message: 'Supabase connection successful', 
      data,
      environment: {
        supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL ? 'Set' : 'Missing',
        supabaseAnonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ? 'Set' : 'Missing'
      }
    });
  } catch (error) {
    console.error('Error testing Supabase connection:', error);
    return NextResponse.json({ 
      success: false, 
      message: 'Exception occurred while testing Supabase connection',
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}