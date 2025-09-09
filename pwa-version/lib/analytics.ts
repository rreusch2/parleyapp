// Facebook Pixel Analytics Library
// This handles all Facebook Pixel tracking for PredictivePlay

declare global {
  interface Window {
    fbq: any;
  }
}

export const FacebookPixel = {
  // Initialize Facebook Pixel
  init(pixelId: string) {
    if (typeof window !== 'undefined' && window.fbq) {
      window.fbq('init', pixelId);
      window.fbq('track', 'PageView');
    }
  },

  // Track standard events
  track(eventName: string, parameters?: Record<string, any>) {
    if (typeof window !== 'undefined' && window.fbq) {
      window.fbq('track', eventName, parameters);
    }
  },

  // Track custom events
  trackCustom(eventName: string, parameters?: Record<string, any>) {
    if (typeof window !== 'undefined' && window.fbq) {
      window.fbq('trackCustom', eventName, parameters);
    }
  },

  // Pre-defined conversion events for PredictivePlay
  events: {
    // User Registration/Signup
    completeRegistration: (method: string = 'email') => {
      FacebookPixel.track('CompleteRegistration', {
        content_name: 'PredictivePlay Account',
        method: method,
        currency: 'USD'
      });
    },

    // Subscription Purchase (Pro upgrade)
    purchase: (value: number, currency: string = 'USD', subscriptionType: string) => {
      FacebookPixel.track('Purchase', {
        value: value,
        currency: currency,
        content_type: 'subscription',
        content_name: subscriptionType,
        content_category: 'Sports Betting Predictions'
      });
    },

    // Lead generation (email signup, trial start)
    lead: (leadType: string = 'email_signup') => {
      FacebookPixel.track('Lead', {
        content_name: leadType,
        content_category: 'sports_predictions',
        value: 0.00,
        currency: 'USD'
      });
    },

    // Subscription initiation (trial start)
    initiateCheckout: (subscriptionType: string, value: number) => {
      FacebookPixel.track('InitiateCheckout', {
        content_type: 'subscription',
        content_name: subscriptionType,
        value: value,
        currency: 'USD',
        num_items: 1
      });
    },

    // User engagement events
    viewContent: (contentType: string, contentName: string) => {
      FacebookPixel.track('ViewContent', {
        content_type: contentType,
        content_name: contentName,
        content_category: 'sports_predictions'
      });
    },

    // Custom events for PredictivePlay
    viewPredictions: () => {
      FacebookPixel.trackCustom('ViewPredictions', {
        content_type: 'predictions',
        event_source: 'web_app'
      });
    },

    clickPrediction: (sport: string, predictionType: string) => {
      FacebookPixel.trackCustom('ClickPrediction', {
        sport: sport,
        prediction_type: predictionType,
        content_type: 'sports_prediction'
      });
    },

    upgradeIntent: (fromPlan: string, toPlan: string) => {
      FacebookPixel.trackCustom('UpgradeIntent', {
        from_plan: fromPlan,
        to_plan: toPlan,
        content_type: 'subscription_upgrade'
      });
    },

    shareResult: (platform: string) => {
      FacebookPixel.trackCustom('ShareResult', {
        platform: platform,
        content_type: 'prediction_result'
      });
    },

    downloadApp: (source: string) => {
      FacebookPixel.trackCustom('DownloadApp', {
        source: source,
        content_type: 'app_download'
      });
    }
  }
};

// Environment-specific pixel ID management
export const getPixelId = (): string => {
  // Replace with your actual Facebook Pixel ID
  const pixelId = process.env.NEXT_PUBLIC_FACEBOOK_PIXEL_ID || 'YOUR_PIXEL_ID_HERE';
  
  if (pixelId === 'YOUR_PIXEL_ID_HERE') {
    console.warn('Facebook Pixel ID not configured. Please set NEXT_PUBLIC_FACEBOOK_PIXEL_ID in your environment variables.');
  }
  
  return pixelId;
};

// Conversion API helpers (for server-side tracking)
export const ConversionsAPI = {
  // This would be used for server-side event tracking
  // Requires Facebook Conversions API setup on your backend
  serverTrack: async (eventName: string, eventData: any, userFbp?: string, userFbc?: string) => {
    try {
      const response = await fetch('/api/facebook/track', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          event_name: eventName,
          event_data: eventData,
          user_fbp: userFbp,
          user_fbc: userFbc,
          event_source_url: window.location.href,
          action_source: 'website'
        })
      });
      
      if (!response.ok) {
        console.error('Server-side tracking failed:', response.statusText);
      }
    } catch (error) {
      console.error('Server-side tracking error:', error);
    }
  }
};
