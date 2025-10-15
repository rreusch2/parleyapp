// Facebook Pixel Analytics for React Native Web
// Integrates with existing Stripe payment flow

declare global {
  interface Window {
    fbq: any;
  }
}

export const FacebookPixel = {
  // Initialize Facebook Pixel for web only
  init() {
    if (typeof window !== 'undefined') {
      // Facebook Pixel base code
      (function(f: any, b: any, e: any, v: any, n: any, t: any, s: any) {
        if (f.fbq) return;
        n = f.fbq = function() {
          n.callMethod ? n.callMethod.apply(n, arguments) : n.queue.push(arguments);
        };
        if (!f._fbq) f._fbq = n;
        n.push = n;
        n.loaded = !0;
        n.version = '2.0';
        n.queue = [];
        t = b.createElement(e);
        t.async = !0;
        t.src = v;
        s = b.getElementsByTagName(e)[0];
        s.parentNode.insertBefore(t, s);
      })(window, document, 'script', 'https://connect.facebook.net/en_US/fbevents.js');

      // Initialize with your Predictive Play web pixel ID
      window.fbq('init', '801467162338511');
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

  // Stripe payment integration events
  trackStripePayment: {
    // Payment intent created
    initiateCheckout: (planId: string, amount: number) => {
      FacebookPixel.track('InitiateCheckout', {
        content_type: 'subscription',
        content_name: planId,
        value: amount / 100, // Convert cents to dollars
        currency: 'USD',
        num_items: 1
      });
    },

    // Payment succeeded
    purchase: (planId: string, amount: number, transactionId: string) => {
      FacebookPixel.track('Purchase', {
        value: amount / 100, // Convert cents to dollars
        currency: 'USD',
        content_type: 'subscription',
        content_name: planId,
        transaction_id: transactionId,
        content_category: 'sports_betting_predictions'
      });
    },

    // Apple Pay specific
    applePay: (amount: number) => {
      FacebookPixel.trackCustom('ApplePayUsed', {
        payment_method: 'apple_pay',
        value: amount / 100,
        currency: 'USD'
      });
    }
  },

  // User registration events
  trackRegistration: (method: string = 'email') => {
    FacebookPixel.track('CompleteRegistration', {
      content_name: 'PredictivePlay Account',
      method: method,
      currency: 'USD'
    });
  },

  // Lead generation
  trackLead: (source: string = 'app') => {
    FacebookPixel.track('Lead', {
      content_name: 'sports_predictions_signup',
      content_category: 'sports_betting',
      source: source,
      value: 0.00,
      currency: 'USD'
    });
  },

  // Content engagement
  trackViewContent: (contentType: string, contentName: string) => {
    FacebookPixel.track('ViewContent', {
      content_type: contentType,
      content_name: contentName,
      content_category: 'sports_predictions'
    });
  },

  // Custom events for PredictivePlay
  events: {
    viewPredictions: (sport?: string) => {
      FacebookPixel.trackCustom('ViewPredictions', {
        content_type: 'predictions',
        sport: sport || 'mixed',
        platform: 'web'
      });
    },

    clickPrediction: (sport: string, predictionType: string) => {
      FacebookPixel.trackCustom('ClickPrediction', {
        sport: sport,
        prediction_type: predictionType,
        content_type: 'sports_prediction'
      });
    },

    upgradeIntent: (currentTier: string, targetTier: string) => {
      FacebookPixel.trackCustom('UpgradeIntent', {
        from_tier: currentTier,
        to_tier: targetTier,
        content_type: 'subscription_upgrade'
      });
    },

    subscriptionCanceled: (planId: string, reason?: string) => {
      FacebookPixel.trackCustom('SubscriptionCanceled', {
        plan_id: planId,
        cancellation_reason: reason || 'unknown'
      });
    }
  }
};

// Auto-initialize on web platform
if (typeof window !== 'undefined') {
  FacebookPixel.init();
}
