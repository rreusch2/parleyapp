#!/bin/bash
# Setup script for UFC/MMA integration

echo "===== UFC/MMA Integration Setup ====="
echo "This script will set up UFC and MMA sports in your Parley App"

# Check if database credentials are set
if [ -z "$PGHOST" ] || [ -z "$PGUSER" ] || [ -z "$PGDATABASE" ]; then
  echo "Database credentials not set. Please provide them now:"
  
  if [ -z "$PGHOST" ]; then
    read -p "Database host: " PGHOST
    export PGHOST
  fi
  
  if [ -z "$PGUSER" ]; then
    read -p "Database user: " PGUSER
    export PGUSER
  fi
  
  if [ -z "$PGDATABASE" ]; then
    read -p "Database name: " PGDATABASE
    export PGDATABASE
  fi
  
  read -s -p "Database password (optional): " PGPASSWORD
  export PGPASSWORD
  echo
fi

echo "===== Applying database changes ====="
echo "Running SQL migration script..."
psql -f add-mma-ufc-sports.sql

if [ $? -ne 0 ]; then
  echo "❌ SQL migration failed. Please check the errors above."
  exit 1
fi

echo "✅ Database migration successful!"

echo "===== Running odds integration setup ====="
echo "This will fetch UFC and MMA events from the API..."
cd backend
npx ts-node src/scripts/setupOddsIntegration.ts

if [ $? -ne 0 ]; then
  echo "❌ Odds integration setup failed. Please check the errors above."
  exit 1
fi

echo "✅ Odds integration setup successful!"
echo
echo "===== UFC/MMA Integration Complete ====="
echo "Please restart your frontend server to see the changes."
echo "The UFC and MMA tabs should now appear in the Games section." 