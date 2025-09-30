# Professor Lock Agent - Railway Environment Variables

Add these environment variables to your Railway service:

## Required Environment Variables

```bash
# Daytona Configuration (for isolated sandboxes)
DAYTONA_API_KEY=dtn_your_daytona_api_key_here

# OpenAI API Key
OPENAI_API_KEY=sk-proj-your_openai_api_key_here

# Anthropic API Key (optional, for vision model)
ANTHROPIC_API_KEY=sk-ant-your_anthropic_key_here

# Supabase Configuration
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_KEY=your_supabase_service_key_here

# Web App API URL
WEB_APP_API_URL=https://zooming-rebirth-production-a305.up.railway.app/api
```

**Note:** Get your actual API keys from:
- Daytona: https://app.daytona.io/dashboard/keys
- OpenAI: https://platform.openai.com/api-keys
- Anthropic: https://console.anthropic.com/settings/keys
- Supabase: Your project settings

## How It Works

1. **railway.toml** - Template config file with `${VAR}` placeholders
2. **start.sh** - Startup script that substitutes env vars into config.toml
3. **Dockerfile** - Copies template and runs start.sh on container start

## Daytona Sandbox Architecture

Each user gets their own isolated Daytona sandbox:
- **Sandbox Image**: `whitezxj/sandbox:0.1.0` (pre-configured with tools)
- **Browser Automation**: Runs inside sandbox with VNC access
- **Tool Execution**: All shell commands, file operations run in isolated container
- **VNC Viewing**: Users can watch agent work via VNC link
- **Resource Isolation**: No conflicts between users

## Next Steps

1. Go to Railway dashboard for your Professor Lock service
2. Navigate to Variables tab
3. Add all the environment variables listed above
4. Redeploy the service
5. Service will start successfully with Daytona configured!
