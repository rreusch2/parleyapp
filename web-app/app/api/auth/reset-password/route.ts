import { supabase } from '@/lib/supabase'

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { email } = body

    if (!email) {
      return new Response('Email is required', { status: 400 })
    }

    const { data, error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/reset-password`,
    })

    if (error) {
      return new Response(`Failed to send reset link: ${error.message}`, { status: 500 })
    }

    return new Response('Password reset link sent successfully', { status: 200 })
  } catch (error) {
    return new Response('Failed to process request', { status: 500 })
  }
}

