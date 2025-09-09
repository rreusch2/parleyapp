#!/usr/bin/env python3
"""
ParleyApp Bulk Email System
Sends emails to all users from predictiveplay2025@gmail.com using Gmail API
"""

import os
import base64
import json
from datetime import datetime
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from email.mime.image import MIMEImage
import time
import logging
from typing import List, Dict, Optional

# Gmail API imports
from google.auth.transport.requests import Request
from google.oauth2.credentials import Credentials
from google_auth_oauthlib.flow import InstalledAppFlow
from googleapiclient.discovery import build
from googleapiclient.errors import HttpError

# Supabase imports
from supabase import create_client, Client

# Gmail API scopes
SCOPES = ['https://www.googleapis.com/auth/gmail.send']

# Email configuration
SENDER_EMAIL = "predictiveplay2025@gmail.com"
SENDER_NAME = "ParleyApp Team"

# Rate limiting (Gmail API limits)
EMAILS_PER_SECOND = 1
EMAILS_PER_DAY = 1000000  # Gmail's daily limit

class ParleyAppEmailer:
    def __init__(self):
        self.setup_logging()
        self.gmail_service = None
        self.supabase_client = None
        
    def setup_logging(self):
        """Setup logging for email automation"""
        logging.basicConfig(
            level=logging.INFO,
            format='%(asctime)s - %(levelname)s - %(message)s',
            handlers=[
                logging.FileHandler(f'email_campaign_{datetime.now().strftime("%Y%m%d_%H%M%S")}.log'),
                logging.StreamHandler()
            ]
        )
        self.logger = logging.getLogger(__name__)

    def authenticate_gmail(self):
        """Authenticate with Gmail API"""
        creds = None
        # Check if token.json exists (previous authentication)
        if os.path.exists('token.json'):
            creds = Credentials.from_authorized_user_file('token.json', SCOPES)
        
        # If no valid credentials, get new ones
        if not creds or not creds.valid:
            if creds and creds.expired and creds.refresh_token:
                creds.refresh(Request())
            else:
                flow = InstalledAppFlow.from_client_secrets_file(
                    'credentials.json', SCOPES)
                creds = flow.run_local_server(port=0)
            
            # Save credentials for next run
            with open('token.json', 'w') as token:
                token.write(creds.to_json())

        try:
            self.gmail_service = build('gmail', 'v1', credentials=creds)
            self.logger.info("✅ Gmail API authentication successful")
            return True
        except Exception as error:
            self.logger.error(f"❌ Gmail API authentication failed: {error}")
            return False

    def connect_supabase(self):
        """Connect to Supabase database"""
        try:
            # Use your Supabase credentials
            supabase_url = "https://iriaegoipkjtktitpary.supabase.co"
            supabase_service_key = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlyaWFlZ29pcGtqdGt0aXRwYXJ5Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0ODkxMTQzMiwiZXhwIjoyMDY0NDg3NDMyfQ.7gTP9UGDkNfIL2jatdP5xSLADJ29KZ1cRb2RGh20kE0"
            
            self.supabase_client = create_client(supabase_url, supabase_service_key)
            self.logger.info("✅ Supabase connection successful")
            return True
        except Exception as error:
            self.logger.error(f"❌ Supabase connection failed: {error}")
            return False

    def get_user_emails(self, tier_filter: Optional[str] = None) -> List[Dict]:
        """Get user emails from Supabase"""
        try:
            query = self.supabase_client.table('profiles').select('email, subscription_tier, username, created_at')
            
            if tier_filter:
                query = query.eq('subscription_tier', tier_filter)
            
            # Filter out null emails
            query = query.not_.is_('email', 'null')
            
            result = query.execute()
            
            users = result.data
            self.logger.info(f"✅ Retrieved {len(users)} user emails" + 
                           (f" (tier: {tier_filter})" if tier_filter else ""))
            
            return users
        except Exception as error:
            self.logger.error(f"❌ Failed to get user emails: {error}")
            return []

    def create_email_message(self, recipient: Dict, template: str, subject: str) -> MIMEMultipart:
        """Create personalized email message"""
        # Personalize content based on user data
        username = recipient.get('username', 'ParleyApp User')
        tier = recipient.get('subscription_tier', 'free').title()
        
        # Replace placeholders in template
        personalized_content = template.replace('{username}', username)
        personalized_content = personalized_content.replace('{tier}', tier)
        personalized_content = personalized_content.replace('{email}', recipient['email'])
        
        # Create message
        message = MIMEMultipart('alternative')
        message['to'] = recipient['email']
        message['from'] = f"{SENDER_NAME} <{SENDER_EMAIL}>"
        message['subject'] = subject
        
        # Add HTML content
        html_part = MIMEText(personalized_content, 'html')
        message.attach(html_part)
        
        return message

    def send_email(self, message: MIMEMultipart) -> bool:
        """Send individual email via Gmail API"""
        try:
            # Encode message
            raw_message = base64.urlsafe_b64encode(message.as_bytes()).decode()
            
            # Send via Gmail API
            send_result = self.gmail_service.users().messages().send(
                userId="me",
                body={'raw': raw_message}
            ).execute()
            
            return True
        except HttpError as error:
            self.logger.error(f"❌ Email send failed: {error}")
            return False
        except Exception as error:
            self.logger.error(f"❌ Unexpected error: {error}")
            return False

    def send_bulk_emails(self, template: str, subject: str, tier_filter: Optional[str] = None):
        """Send bulk emails to users"""
        if not self.authenticate_gmail() or not self.connect_supabase():
            return False
        
        # Get user list
        users = self.get_user_emails(tier_filter)
        if not users:
            self.logger.error("❌ No users found to email")
            return False
        
        self.logger.info(f"🚀 Starting bulk email campaign to {len(users)} users")
        
        successful_sends = 0
        failed_sends = 0
        
        for i, user in enumerate(users, 1):
            try:
                # Create personalized message
                message = self.create_email_message(user, template, subject)
                
                # Send email
                if self.send_email(message):
                    successful_sends += 1
                    self.logger.info(f"✅ {i}/{len(users)} - Sent to {user['email']}")
                else:
                    failed_sends += 1
                    self.logger.error(f"❌ {i}/{len(users)} - Failed to send to {user['email']}")
                
                # Rate limiting - wait between sends
                time.sleep(1/EMAILS_PER_SECOND)
                
                # Progress logging every 50 emails
                if i % 50 == 0:
                    self.logger.info(f"📊 Progress: {i}/{len(users)} sent ({successful_sends} success, {failed_sends} failed)")
                    
            except Exception as error:
                failed_sends += 1
                self.logger.error(f"❌ Error processing user {user['email']}: {error}")
        
        # Final summary
        self.logger.info(f"🎯 Campaign Complete!")
        self.logger.info(f"   ✅ Successful: {successful_sends}")
        self.logger.info(f"   ❌ Failed: {failed_sends}")
        self.logger.info(f"   📈 Success Rate: {(successful_sends/len(users)*100):.1f}%")
        
        return successful_sends > 0

def main():
    """Main function for email campaign"""
    emailer = ParleyAppEmailer()
    
    # EMAIL TEMPLATE - Customize this for your campaign
    email_template = """
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="utf-8">
        <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
            .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
            .cta-button { display: inline-block; background: #667eea; color: white; padding: 15px 30px; text-decoration: none; border-radius: 5px; font-weight: bold; margin: 20px 0; }
            .footer { text-align: center; color: #666; font-size: 14px; margin-top: 30px; }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <h1>🏆 Big ParleyApp Update!</h1>
                <p>Hey {username}, we've got some exciting news...</p>
            </div>
            <div class="content">
                <p>Hi {username},</p>
                
                <p>Hope you're crushing it with ParleyApp! 🚀</p>
                
                <p><strong>We just launched some major updates that you're going to love:</strong></p>
                
                <ul>
                    <li>🎯 <strong>Enhanced AI Predictions</strong> - Even sharper picks with improved algorithms</li>
                    <li>📊 <strong>Multi-Sport Coverage</strong> - MLB, WNBA, and UFC predictions now available</li>
                    <li>🤖 <strong>Professor Lock 2.0</strong> - Your AI betting assistant got a major upgrade</li>
                    <li>📈 <strong>Better Analytics</strong> - Track your wins with enhanced performance insights</li>
                </ul>
                
                <p>As a {tier} member, you have access to all the latest features. Jump back in and check out the improvements!</p>
                
                <a href="https://predictiveplay.app" class="cta-button">Open ParleyApp Now →</a>
                
                <p><strong>What's Next?</strong></p>
                <p>We're working on even more exciting features based on your feedback. Keep an eye out for:</p>
                <ul>
                    <li>🎲 Live betting alerts</li>
                    <li>🏀 NBA season prep tools</li>
                    <li>👥 Social betting features</li>
                </ul>
                
                <p>Thanks for being part of the ParleyApp family! 💙</p>
                
                <p>Best,<br>
                The ParleyApp Team</p>
            </div>
            <div class="footer">
                <p>ParleyApp - Smart Betting, Powered by AI</p>
                <p>Questions? Reply to this email or contact us at support@predictiveplay.app</p>
            </div>
        </div>
    </body>
    </html>
    """
    
    # EMAIL SUBJECT
    subject = "🚀 Major ParleyApp Updates Are Live!"
    
    # SEND EMAILS
    # Options:
    # - Send to all users: tier_filter=None
    # - Send to free users only: tier_filter="free"
    # - Send to pro users only: tier_filter="pro"
    # - Send to elite users only: tier_filter="elite"
    
    emailer.send_bulk_emails(
        template=email_template,
        subject=subject,
        tier_filter=None  # Send to all users
    )

if __name__ == "__main__":
    main()
