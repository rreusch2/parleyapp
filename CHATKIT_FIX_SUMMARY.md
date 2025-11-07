# ChatKit Self-Hosted Integration Fix

## Problem
ChatKit UI was not showing on the frontend. The component was mounting but not connecting properly to the Railway Python backend.

## Root Causes
1. **Python Server Protocol Mismatch**: The `ProfessorLockChatKitServer.respond()` method signature didn't match OpenAI's official ChatKit server protocol
2. **Missing Input Type Handling**: Server wasn't handling `ClientToolCallOutputItem` type
3. **React Component Config**: Needed proper domainKey handling for self-hosted setup

## Fixes Applied

### 1. Python Server (`pykit/pp_server.py`)
- ✅ Fixed `respond()` method signature to match official protocol:
  - Changed from `input_user_message: UserMessageItem | None` to `input: UserMessageItem | ClientToolCallOutputItem`
  - Changed return type from `AsyncIterator[ThreadStreamEvent]` to `AsyncIterator[Event]`
- ✅ Added proper input type handling for both UserMessageItem and ClientToolCallOutputItem
- ✅ Fixed `action()` return type to `AsyncIterator[Event]`
- ✅ Added required type imports: `Event`, `ClientToolCallOutputItem`

### 2. React Component (`pplayweb/components/professor-lock/SelfHostedChatKit.tsx`)
- ✅ Using `@openai/chatkit-react` package properly
- ✅ Using dummy domainKey `self_hosted_predictive_play` for self-hosted backend
- ✅ Passing auth headers in custom fetch function
- ✅ Fixed TypeScript errors with proper config structure

### 3. Type Definitions (`pplayweb/types/chatkit.d.ts`)
- ✅ Added TypeScript declarations for `<openai-chatkit>` custom element

## Next Steps

### Deploy to Railway
The Python backend has been updated with the correct ChatKit protocol implementation. Deploy it:

```powershell
cd C:\Users\reidr\parleyapp\pykit
git add .
git commit -m "Fix ChatKit server protocol implementation"
git push
```

Railway will auto-deploy the changes.

### Test the Integration
1. Wait for Railway deployment to complete (check https://railway.app)
2. Navigate to `/professor-lock` on your web app
3. You should now see the ChatKit UI load properly
4. Try sending a message to Professor Lock

### What Should Work
- ✅ ChatKit UI renders on the page
- ✅ User can send messages
- ✅ Professor Lock agent responds with personality
- ✅ Widgets display (search progress, odds, parlays)
- ✅ Auth headers passed correctly to backend
- ✅ User tier info available to agent

### Monitoring
Check Railway logs to see:
- "🎯 Received ChatKit request" when frontend connects
- "📋 User context: {user_id} (elite/pro/free)"
- Agent responses streaming correctly

## Technical Details

### Official ChatKit Server Protocol
According to OpenAI docs, the self-hosted ChatKit server must implement:
```python
async def respond(
    self,
    thread: ThreadMetadata,
    input: UserMessageItem | ClientToolCallOutputItem,
    context: Any,
) -> AsyncIterator[Event]:
```

Our implementation now matches this exactly.

### How It Works
1. Frontend loads `@openai/chatkit-react` package
2. Component configures ChatKit with custom API URL pointing to Railway
3. Custom fetch function injects Supabase auth headers
4. Railway Python server receives requests at `/chatkit` endpoint
5. `ProfessorLockChatKitServer` processes messages using Agents SDK
6. Responses stream back to frontend with widgets and messages
7. ChatKit UI renders the conversation

## Benefits of Self-Hosted
- 🔧 Full control over agent personality and tools
- 📊 Custom widgets (parlay builder, odds comparison, search progress)
- 🎯 Integration with StatMuse, web search, betting analysis
- 💾 Data stored in your Supabase database
- 🚀 No OpenAI platform rate limits
- 💰 More cost-effective for high usage

Let me know when you've deployed and I'll help troubleshoot if needed!
