# StatMuse API Service

This is a standalone service that wraps the StatMuse API server for use by Predictive Play applications.

## Overview

The StatMuse API Service provides a HTTP interface to query StatMuse for sports statistics and insights. It runs as a separate service and can be deployed independently from the main Predictive Play backend.

## Deployment

### Railway

1. Create a new project in Railway
2. Connect to this repository and select just this folder (`statmuse-api-service`) for deployment
3. Set the following environment variables:
   - `PORT`: The port to run the service on (Railway will set this automatically)
   - Any other environment variables needed by the StatMuse API server

### Local Development

1. Install dependencies:
   ```
   npm install
   pip install -r requirements.txt
   ```

2. Run the service:
   ```
   node index.js
   ```

## API Endpoints

- `POST /query` - Query StatMuse with a specific question
- `GET /health` - Health check endpoint
- `GET /scrape-context` - Scrape current sports context from StatMuse
- `POST /head-to-head` - Get head-to-head matchup data
- `POST /team-record` - Get team record data
- `POST /player-stats` - Get player statistics

## Integration

In your Python scripts, use the following environment variable to access the StatMuse API:

```python
import os
import requests

# Get the StatMuse API URL from environment variable, with fallback
STATMUSE_API_URL = os.getenv("STATMUSE_API_URL", "http://localhost:5001")

# Use the API
response = requests.post(f"{STATMUSE_API_URL}/query", json={"query": "A'ja Wilson stats this season"})
data = response.json()
```

Set the `STATMUSE_API_URL` environment variable in your main backend to point to this service.