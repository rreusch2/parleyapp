import { Router } from 'express';
import { supabaseAdmin } from '../../services/supabase/client';
import ratelimit from '../../middleware/rateLimit';

const router = Router();

// Phone verification endpoint
router.post('/verify-phone', ratelimit, async (req, res) => {
  try {
    const { phoneNumber, verificationCode, userId } = req.body;

    if (!phoneNumber || !verificationCode || !userId) {
      return res.status(400).json({
        error: 'Phone number, verification code, and user ID are required'
      });
    }

    // Verify the OTP with Supabase Auth
    const { data, error } = await supabaseAdmin.auth.verifyOtp({
      phone: phoneNumber,
      token: verificationCode,
      type: 'sms'
    });

    if (error) {
      console.error('Phone verification error:', error);
      return res.status(400).json({
        error: error.message || 'Invalid verification code'
      });
    }

    // Update user profile with verified phone number
    const { error: updateError } = await supabaseAdmin
      .from('profiles')
      .update({
        phone_number: phoneNumber,
        phone_verified: true,
        phone_verified_at: new Date().toISOString(),
        verification_attempts: 0, // Reset attempts on success
        updated_at: new Date().toISOString()
      })
      .eq('id', userId);

    if (updateError) {
      console.error('Profile update error:', updateError);
      return res.status(500).json({
        error: 'Failed to update user profile'
      });
    }

    res.json({
      success: true,
      message: 'Phone number verified successfully',
      phoneNumber
    });

  } catch (error) {
    console.error('Phone verification endpoint error:', error);
    res.status(500).json({
      error: 'Internal server error'
    });
  }
});

// Check phone trial eligibility endpoint
router.post('/check-phone-eligibility', ratelimit, async (req, res) => {
  try {
    const { phoneNumber } = req.body;

    if (!phoneNumber) {
      return res.status(400).json({
        error: 'Phone number is required'
      });
    }

    // Check if phone number has been used for trial before
    const { data: existingUsers, error } = await supabaseAdmin
      .from('profiles')
      .select('id, phone_verified, trial_used, created_at')
      .eq('phone_number', phoneNumber)
      .eq('phone_verified', true);

    if (error) {
      console.error('Phone eligibility check error:', error);
      return res.status(500).json({
        error: 'Failed to check phone eligibility'
      });
    }

    // Check if any verified user with this phone has used trial
    const hasUsedTrial = existingUsers?.some(user => user.trial_used === true);

    res.json({
      eligible: !hasUsedTrial,
      phoneNumber,
      message: hasUsedTrial 
        ? 'This phone number has already been used for a free trial'
        : 'Phone number is eligible for free trial'
    });

  } catch (error) {
    console.error('Phone eligibility endpoint error:', error);
    res.status(500).json({
      error: 'Internal server error'
    });
  }
});

// Increment verification attempts endpoint
router.post('/increment-verification-attempts', ratelimit, async (req, res) => {
  try {
    const { userId } = req.body;

    if (!userId) {
      return res.status(400).json({
        error: 'User ID is required'
      });
    }

    // Get current attempts
    const { data: profile, error: fetchError } = await supabaseAdmin
      .from('profiles')
      .select('verification_attempts, last_verification_attempt')
      .eq('id', userId)
      .single();

    if (fetchError) {
      console.error('Failed to fetch verification attempts:', fetchError);
      return res.status(500).json({
        error: 'Failed to fetch user data'
      });
    }

    const now = new Date();
    const lastAttempt = profile.last_verification_attempt 
      ? new Date(profile.last_verification_attempt) 
      : null;

    // Reset attempts if last attempt was more than 24 hours ago
    let attempts = profile.verification_attempts || 0;
    if (lastAttempt && (now.getTime() - lastAttempt.getTime()) > 24 * 60 * 60 * 1000) {
      attempts = 0;
    }

    attempts += 1;

    // Check if user has exceeded max attempts (5 per 24 hours)
    if (attempts > 5) {
      return res.status(429).json({
        error: 'Too many verification attempts. Please wait 24 hours before trying again.',
        attemptsRemaining: 0,
        resetTime: lastAttempt ? new Date(lastAttempt.getTime() + 24 * 60 * 60 * 1000) : null
      });
    }

    // Update attempts count
    const { error: updateError } = await supabaseAdmin
      .from('profiles')
      .update({
        verification_attempts: attempts,
        last_verification_attempt: now.toISOString(),
        updated_at: now.toISOString()
      })
      .eq('id', userId);

    if (updateError) {
      console.error('Failed to update verification attempts:', updateError);
      return res.status(500).json({
        error: 'Failed to update verification attempts'
      });
    }

    res.json({
      success: true,
      attempts,
      attemptsRemaining: 5 - attempts,
      message: `Verification attempt ${attempts}/5 recorded`
    });

  } catch (error) {
    console.error('Increment verification attempts error:', error);
    res.status(500).json({
      error: 'Internal server error'
    });
  }
});

// Send verification code endpoint
router.post('/send-verification-code', ratelimit, async (req, res) => {
  try {
    const { phoneNumber, userId } = req.body;

    if (!phoneNumber || !userId) {
      return res.status(400).json({
        error: 'Phone number and user ID are required'
      });
    }

    // Check rate limiting first
    const attemptsResponse = await fetch(`${req.protocol}://${req.get('host')}/api/auth/increment-verification-attempts`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId })
    });

    if (!attemptsResponse.ok) {
      const attemptsError = await attemptsResponse.json();
      return res.status(attemptsResponse.status).json(attemptsError);
    }

    // Check phone eligibility
    const eligibilityResponse = await fetch(`${req.protocol}://${req.get('host')}/api/auth/check-phone-eligibility`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phoneNumber })
    });

    if (!eligibilityResponse.ok) {
      return res.status(500).json({
        error: 'Failed to check phone eligibility'
      });
    }

    const eligibilityData = await eligibilityResponse.json();
    if (!eligibilityData.eligible) {
      return res.status(400).json({
        error: 'This phone number has already been used for a free trial',
        eligible: false
      });
    }

    // Send OTP via Supabase Auth
    const { error } = await supabaseAdmin.auth.signInWithOtp({
      phone: phoneNumber
    });

    if (error) {
      console.error('Failed to send verification code:', error);
      return res.status(400).json({
        error: error.message || 'Failed to send verification code'
      });
    }

    res.json({
      success: true,
      message: 'Verification code sent successfully',
      phoneNumber
    });

  } catch (error) {
    console.error('Send verification code endpoint error:', error);
    res.status(500).json({
      error: 'Internal server error'
    });
  }
});

export default router;
