# PredictAI Backend

This is the backend for the PredictAI sports betting application. It provides APIs for user preferences, predictions, sports events, and bet history.

## Sports Data Integration

The backend integrates with API-Sports to fetch real-time sports data, including fixtures, odds, and team statistics. This data is used to generate AI-powered predictions for users.

## Setup

1. Install dependencies:
   ```
   npm install
   ```

2. Set up API-Sports key:
   ```
   node setup-api-key.js
   ```
   Follow the prompts to enter your API-Sports key. You can get your API key from [API-Sports Dashboard](https://dashboard.api-football.com/profile?access).

3. Set up Supabase credentials:
   Create a `.env` file in the backend directory with the following content:
   ```
   # Server configuration
   PORT=3000

   # Supabase configuration
   SUPABASE_URL=your_supabase_url
   SUPABASE_ANON_KEY=your_supabase_anon_key

   # API-Sports key (if not set up using setup-api-key.js)
   API_SPORTS_KEY=your_api_sports_key
   ```

4. Start the development server:
   ```
   npm run dev
   ```

## Features

- **Sports Data Fetching**: Automatically fetches and updates sports data from API-Sports.
- **Scheduled Updates**: Uses cron jobs to periodically update sports data and game statuses.
- **AI Predictions**: Generates personalized predictions based on user preferences.
- **User Preferences**: Stores and manages user betting preferences.
- **Bet Tracking**: Allows users to track their bets and view betting history.

## API Endpoints

### Sports Events
- `GET /api/sports-events`: Get upcoming sports events with optional filters
- `GET /api/sports-events/search`: Search sports events by team or league name
- `GET /api/sports-events/:id`: Get details for a specific sports event

### Predictions
- `GET /api/predictions`: Get predictions for the current user
- `GET /api/predictions/:id`: Get a specific prediction
- `POST /api/predictions`: Generate a new prediction

### User Preferences
- `GET /api/user-preferences`: Get the current user's preferences
- `POST /api/user-preferences`: Create user preferences
- `PUT /api/user-preferences`: Update user preferences

### Bet History
- `GET /api/bets`: Get the current user's bet history
- `GET /api/bets/:id`: Get details for a specific bet
- `POST /api/bets`: Create a new bet
- `PATCH /api/bets/:id/result`: Update the result of a bet

### Sports Data Admin
- `POST /api/sports-data-admin/update`: Manually trigger a sports data update
- `GET /api/sports-data-admin/leagues`: Get available leagues
- `POST /api/sports-data-admin/update-statuses`: Update game statuses 