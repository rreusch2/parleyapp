# Predictive Play Backend

This is the backend for the Predictive Play app, a top-of-the-line AI-powered sports betting application.

## AI Orchestrator Architecture

The AI system is built as an orchestrator pattern with the following components:

### Core Components

1. **Gemini Orchestrator**: Coordinates all tools and generates personalized betting recommendations
2. **Prediction Tools**:
   - SportsDataIO (BAKER Engine) for US sports predictions
   - Sportmonks for football (soccer) predictions
3. **Web Search Tool**: Gathers qualitative information like injury reports and team news
4. **User Data Tool**: Accesses user preferences and betting history for personalization

### API Endpoints

- `POST /api/ai/recommendations`: Generate betting recommendations
- `GET /api/ai/health`: Check orchestrator health

## Setup Instructions

1. Clone the repository
2. Install dependencies:
   ```
   cd backend
   npm install
   ```
3. Copy `env.example` to `.env` and fill in your API keys
4. Start the development server:
   ```
   npm run dev
   ```

## API Keys Required

- **Gemini API Key**: For the LLM orchestrator
- **SportsDataIO API Key**: For US sports predictions (NBA, NFL, MLB, NHL)
- **Sportmonks API Key**: For football (soccer) predictions
- **Sportradar API Key**: For odds data
- **Search API Key**: Either SerpAPI or Google Custom Search
- **Supabase Keys**: For user data storage

## Testing

Run the test script to verify all tools are working:

```
npm run test:ai-tools
```

## Supported Bet Types

- `moneyline`: Team to win (US sports)
- `spread`: Point spread bets (US sports)
- `total`: Over/under bets (US sports)
- `player_prop`: Player prop bets (US sports)
- `football_1x2`: Home/Draw/Away (football)
- `football_over_under`: Over/under goals (football)

## Sports Data Integration

The backend integrates with API-Sports to fetch real-time sports data, including fixtures, odds, and team statistics. This data is used to generate AI-powered predictions for users.

## SportRadar API Integration

We've successfully integrated with SportRadar's API endpoints. The following endpoints have been confirmed to work with a valid API key:

1. **Player Props Sports**
   - Endpoint: `https://api.sportradar.us/oddscomparison-player-props/trial/v2/en/sports.json`

2. **Prematch Sports**
   - Endpoint: `https://api.sportradar.us/oddscomparison-prematch/trial/v2/en/sports.json`

3. **NBA API**
   - Endpoint: `https://api.sportradar.us/nba/trial/v8/en/league/hierarchy.json`

4. **MLB API**
   - Endpoint: `https://api.sportradar.us/mlb/trial/v7/en/league/hierarchy.json`

5. **NHL API**
   - Endpoint: `https://api.sportradar.us/nhl/trial/v7/en/league/hierarchy.json`

6. **NBA Daily Schedule**
   - Endpoint: `https://api.sportradar.us/nba/trial/v8/en/games/{year}/{month}/{day}/schedule.json`

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

### SportRadar API
- `/api/sports-data/sports`: List of available sports
- `/api/sports-data/prematch`: Prematch sports data
- `/api/sports-data/nba/hierarchy`: NBA league hierarchy
- `/api/sports-data/mlb/hierarchy`: MLB league hierarchy
- `/api/sports-data/nhl/hierarchy`: NHL league hierarchy
- `/api/sports-data/nba/schedule/:year/:month/:day`: NBA daily schedule
- `/api/sports-data/nba/boxscore/:gameId`: NBA game boxscore
- `/api/sports-data/markets/player-props`: Player props markets

## Other Documentation

[Additional backend documentation here] 