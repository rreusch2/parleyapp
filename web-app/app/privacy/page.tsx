import Link from 'next/link'
import { Brain } from 'lucide-react'

export default function PrivacyPolicy() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-blue-900 to-gray-900">
      {/* Header */}
      <nav className="bg-black/20 backdrop-blur-md border-b border-white/10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <Link href="/" className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center">
                <Brain className="w-6 h-6 text-white" />
              </div>
              <span className="text-2xl font-bold text-white">
                Predictive Play
              </span>
            </Link>
            
            <Link 
              href="/"
              className="text-white hover:text-blue-300 transition-colors font-medium"
            >
              Back to Home
            </Link>
          </div>
        </div>
      </nav>

      {/* Content */}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="bg-white/5 backdrop-blur-sm rounded-xl p-8 border border-white/10">
          <h1 className="text-4xl font-bold text-white mb-8">Privacy Policy</h1>
          
          <div className="prose prose-invert prose-blue max-w-none">
            <div className="text-gray-300 space-y-6">
              <p><strong>Effective Date:</strong> January 1, 2025</p>
              
              <p>
                Welcome to Predictive Play! This Privacy Policy explains how we collect, use, disclose, 
                and safeguard your information when you use our AI-powered sports betting prediction 
                platform, whether through our mobile application or web service.
              </p>

              <h2 className="text-2xl font-semibold text-white mt-8 mb-4">Information We Collect</h2>
              
              <h3 className="text-xl font-semibold text-blue-400 mt-6 mb-3">Personal Information</h3>
              <ul className="list-disc pl-6 space-y-2">
                <li>Account information (email address, username, password)</li>
                <li>Profile information (display name, preferences)</li>
                <li>Payment information (processed securely through Stripe)</li>
                <li>Communication data (support messages, feedback)</li>
              </ul>

              <h3 className="text-xl font-semibold text-blue-400 mt-6 mb-3">Usage Information</h3>
              <ul className="list-disc pl-6 space-y-2">
                <li>App usage patterns and feature interactions</li>
                <li>Prediction viewing and betting preferences</li>
                <li>Device information and technical data</li>
                <li>Performance analytics and crash reports</li>
              </ul>

              <h2 className="text-2xl font-semibold text-white mt-8 mb-4">How We Use Your Information</h2>
              <ul className="list-disc pl-6 space-y-2">
                <li>Provide and improve our AI prediction services</li>
                <li>Personalize your experience and recommendations</li>
                <li>Process payments and manage subscriptions</li>
                <li>Send important updates and notifications</li>
                <li>Provide customer support</li>
                <li>Ensure platform security and prevent fraud</li>
              </ul>

              <h2 className="text-2xl font-semibold text-white mt-8 mb-4">Information Sharing</h2>
              <p>
                We do not sell, trade, or rent your personal information to third parties. 
                We may share information only in these circumstances:
              </p>
              <ul className="list-disc pl-6 space-y-2">
                <li>With service providers (Stripe for payments, analytics providers)</li>
                <li>When required by law or legal process</li>
                <li>To protect our rights and prevent fraud</li>
                <li>With your explicit consent</li>
              </ul>

              <h2 className="text-2xl font-semibold text-white mt-8 mb-4">Data Security</h2>
              <p>
                We implement industry-standard security measures including encryption, 
                secure data transmission, and regular security audits. However, no method 
                of electronic transmission or storage is 100% secure.
              </p>

              <h2 className="text-2xl font-semibold text-white mt-8 mb-4">Your Rights</h2>
              <p>You have the right to:</p>
              <ul className="list-disc pl-6 space-y-2">
                <li>Access your personal information</li>
                <li>Correct inaccurate data</li>
                <li>Delete your account and associated data</li>
                <li>Opt-out of marketing communications</li>
                <li>Data portability (where applicable)</li>
              </ul>

              <h2 className="text-2xl font-semibold text-white mt-8 mb-4">Children's Privacy</h2>
              <p>
                Our service is not intended for users under 18 years of age. We do not 
                knowingly collect personal information from children under 18.
              </p>

              <h2 className="text-2xl font-semibold text-white mt-8 mb-4">Changes to Privacy Policy</h2>
              <p>
                We may update this Privacy Policy periodically. We will notify you of 
                significant changes through the app or by email.
              </p>

              <h2 className="text-2xl font-semibold text-white mt-8 mb-4">Contact Us</h2>
              <p>
                If you have questions about this Privacy Policy, please contact us at:
              </p>
              <div className="bg-blue-900/30 p-4 rounded-lg mt-4">
                <p><strong>Email:</strong> predictiveplay2025@gmail.com</p>
                <p><strong>Address:</strong> Predictive Play Privacy Team</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}