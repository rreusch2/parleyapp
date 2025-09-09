'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { FacebookPixel } from '@/lib/analytics';

export default function HomePage() {
  const router = useRouter();

  useEffect(() => {
    // Track homepage view
    FacebookPixel.events.viewContent('homepage', 'PredictivePlay Landing Page');
  }, []);

  const handleGetStarted = () => {
    // Track lead generation intent
    FacebookPixel.events.lead('homepage_cta');
    router.push('/dashboard');
  };

  const handleSignUp = () => {
    // Track registration intent
    FacebookPixel.track('InitiateCheckout', {
      content_type: 'registration',
      content_name: 'Free Account',
      value: 0,
      currency: 'USD'
    });
    // Redirect to actual signup flow
    router.push('/signup');
  };

  const handleUpgradeToPro = () => {
    // Track subscription intent
    FacebookPixel.events.upgradeIntent('free', 'pro');
    FacebookPixel.events.initiateCheckout('Pro Subscription', 19.99);
    // Redirect to subscription flow
    router.push('/upgrade');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      {/* Hero Section */}
      <div className="container mx-auto px-4 py-16">
        <div className="text-center max-w-4xl mx-auto">
          <h1 className="text-5xl md:text-7xl font-bold bg-gradient-to-r from-cyan-400 to-purple-400 bg-clip-text text-transparent mb-6">
            PredictivePlay
          </h1>
          <p className="text-xl md:text-2xl text-gray-300 mb-8">
            AI-Powered Sports Predictions That Actually Win
          </p>
          <p className="text-lg text-gray-400 mb-12 max-w-2xl mx-auto">
            Get advanced analytics, real-time insights, and winning predictions powered by machine learning algorithms trained on years of sports data.
          </p>
          
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <button
              onClick={handleGetStarted}
              className="bg-cyan-400 text-slate-900 px-8 py-4 rounded-full font-bold text-lg hover:bg-cyan-300 transition-all transform hover:scale-105"
            >
              Start Free Trial
            </button>
            <button
              onClick={handleUpgradeToPro}
              className="bg-purple-600 text-white px-8 py-4 rounded-full font-bold text-lg hover:bg-purple-500 transition-all transform hover:scale-105"
            >
              Upgrade to Pro - $19.99
            </button>
          </div>
        </div>

        {/* Features Grid */}
        <div className="grid md:grid-cols-3 gap-8 mt-20">
          <div className="bg-slate-800/50 rounded-2xl p-8 text-center backdrop-blur-sm">
            <div className="w-16 h-16 bg-cyan-400/20 rounded-full flex items-center justify-center mx-auto mb-4">
              <span className="text-2xl">🎯</span>
            </div>
            <h3 className="text-xl font-bold mb-4">AI Predictions</h3>
            <p className="text-gray-400">Advanced machine learning algorithms analyze player stats, team performance, and historical data.</p>
          </div>
          
          <div className="bg-slate-800/50 rounded-2xl p-8 text-center backdrop-blur-sm">
            <div className="w-16 h-16 bg-purple-400/20 rounded-full flex items-center justify-center mx-auto mb-4">
              <span className="text-2xl">📊</span>
            </div>
            <h3 className="text-xl font-bold mb-4">Real-Time Analytics</h3>
            <p className="text-gray-400">Live updates on player conditions, weather, injuries, and lineup changes that affect outcomes.</p>
          </div>
          
          <div className="bg-slate-800/50 rounded-2xl p-8 text-center backdrop-blur-sm">
            <div className="w-16 h-16 bg-green-400/20 rounded-full flex items-center justify-center mx-auto mb-4">
              <span className="text-2xl">💰</span>
            </div>
            <h3 className="text-xl font-bold mb-4">Proven Results</h3>
            <p className="text-gray-400">73% win rate with +24.8% ROI. Join thousands of profitable users.</p>
          </div>
        </div>

        {/* Call to Action */}
        <div className="text-center mt-20">
          <div className="bg-gradient-to-r from-cyan-400/10 to-purple-400/10 rounded-2xl p-8 backdrop-blur-sm border border-cyan-400/20">
            <h2 className="text-3xl font-bold mb-4">Ready to Start Winning?</h2>
            <p className="text-gray-300 mb-6">Join the thousands of users who trust PredictivePlay for their sports betting decisions.</p>
            <button
              onClick={handleSignUp}
              className="bg-gradient-to-r from-cyan-400 to-purple-400 text-slate-900 px-8 py-4 rounded-full font-bold text-lg hover:from-cyan-300 hover:to-purple-300 transition-all transform hover:scale-105"
            >
              Create Free Account
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
