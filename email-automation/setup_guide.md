# ParleyApp Bulk Email System - Complete Setup Guide

## Step 1: Enable Gmail API in Google Cloud Console

1. **Go to Google Cloud Console**: https://console.cloud.google.com/
2. **Create or select a project**:
   - Click "Select a project" → "NEW PROJECT"
   - Name it "ParleyApp Email System"
   - Click "CREATE"

3. **Enable Gmail API**:
   - Go to "APIs & Services" → "Library"
   - Search for "Gmail API"
   - Click on it and press "ENABLE"

4. **Create OAuth 2.0 Credentials**:
   - Go to "APIs & Services" → "Credentials"
   - Click "CREATE CREDENTIALS" → "OAuth client ID"
   - If prompted, configure OAuth consent screen:
     - Choose "External" user type
     - Fill in app name: "ParleyApp Email System"
     - User support email: support@predictive-play.com
     - Developer contact: support@predictive-play.com
     - Save and continue through all steps
   - Choose "Desktop application" as application type
   - Name it "ParleyApp Emailer"
   - Click "CREATE"

5. **Download credentials**:
   - Click the download icon next to your OAuth client
   - Save as `credentials.json` in the email-automation folder

## Step 2: Install Required Dependencies

```bash
cd /home/reid/Desktop/parleyapp/email-automation
pip install google-auth google-auth-oauthlib google-auth-httplib2 google-api-python-client supabase
```

## Step 3: Authentication Setup

1. **Place credentials.json** in `/home/reid/Desktop/parleyapp/email-automation/`
2. **Run authentication** (first time only):
   ```bash
   python gmail_bulk_emailer.py
   ```
3. **Browser will open** asking you to:
   - Sign in to support@predictive-play.com
   - Grant permissions to send emails
   - This creates `token.json` for future use

## Step 4: Customize Your Email Campaign

Edit the email template in `gmail_bulk_emailer.py`:

```python
# EMAIL TEMPLATE - Customize this section
email_template = """
<!DOCTYPE html>
<html>
<!-- Your custom HTML email template -->
</html>
"""

# EMAIL SUBJECT
subject = "🚀 Your Custom Subject Here"

# TARGET AUDIENCE OPTIONS:
# Send to all users (885 emails):
tier_filter=None

# Send to free users only (814 emails):
tier_filter="free"

# Send to pro users only (26 emails):
tier_filter="pro"

# Send to elite users only (45 emails):
tier_filter="elite"
```

## Step 5: Run Email Campaign

### Option A: Send to All Users (885 emails)
```bash
cd /home/reid/Desktop/parleyapp/email-automation
python gmail_bulk_emailer.py
```

### Option B: Send to Specific User Tier
Edit `gmail_bulk_emailer.py` and change the tier_filter parameter, then run:
```bash
python gmail_bulk_emailer.py
```

## Step 6: Monitor Progress

The script will:
- ✅ Log each email sent/failed
- 📊 Show progress every 50 emails
- 💾 Save detailed logs to file
- ⏱️ Respect Gmail rate limits (1 email/second)
- 📈 Provide final success/failure summary

## Email Campaign Analytics

**Your Current User Base:**
- **Total Users**: 890
- **Valid Emails**: 885 (99.4% deliverable)
- **Free Users**: 814 emails (91.9%)
- **Pro Users**: 26 emails (2.9%)
- **Elite Users**: 45 emails (5.1%)

## Gmail Limits & Best Practices

- **Daily Limit**: 1,000,000 emails (way more than needed)
- **Rate Limit**: 1 email per second (built into script)
- **Authentication**: OAuth 2.0 (secure, no password needed)
- **Deliverability**: Gmail-to-Gmail has excellent delivery rates

## Quick Start Commands

```bash
# 1. Navigate to email automation folder
cd /home/reid/Desktop/parleyapp/email-automation

# 2. Install dependencies (one time)
pip install google-auth google-auth-oauthlib google-auth-httplib2 google-api-python-client supabase

# 3. Add your credentials.json file (from Google Cloud Console)

# 4. Run the campaign
python gmail_bulk_emailer.py
```

## Troubleshooting

**"File 'credentials.json' not found"**:
- Download OAuth credentials from Google Cloud Console
- Place in `/home/reid/Desktop/parleyapp/email-automation/credentials.json`

**"Authentication failed"**:
- Ensure you're signed into support@predictive-play.com
- Grant all permissions when prompted
- Check if Gmail API is enabled in Google Cloud Console

**"Rate limit exceeded"**:
- Script automatically handles rate limiting
- Gmail allows 1 email/second (built into code)
- For 885 emails, expect ~15 minutes completion time

**Email delivery issues**:
- Gmail-to-Gmail has 99%+ delivery rates
- Check spam folders for test emails
- Avoid excessive promotional language

## Next Steps After Setup

1. **Test with small batch first**: Change `tier_filter="pro"` to test with 26 users
2. **Monitor engagement**: Track open rates and responses
3. **Segment campaigns**: Use tier filters for targeted messaging
4. **Schedule regular updates**: Set up cron jobs for automated campaigns
