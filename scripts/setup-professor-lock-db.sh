#!/bin/bash

# Professor Lock Database Setup Script
# This script helps you run the database migration for Professor Lock web experience

set -e

echo "🎓 Professor Lock Database Setup"
echo "================================="
echo ""

# Check if migration file exists
MIGRATION_FILE="database/migrations/20250929_professor_lock_schema.sql"

if [ ! -f "$MIGRATION_FILE" ]; then
    echo "❌ Error: Migration file not found at $MIGRATION_FILE"
    exit 1
fi

echo "✅ Migration file found"
echo ""
echo "📋 This will create the following tables:"
echo "   • professor_lock_sessions"
echo "   • professor_lock_messages"
echo "   • professor_lock_events"
echo "   • professor_lock_artifacts"
echo "   • Storage bucket: professor-lock-artifacts"
echo ""

# Check for Supabase CLI
if command -v supabase &> /dev/null; then
    echo "✅ Supabase CLI detected"
    echo ""
    echo "Would you like to run the migration now? (y/n)"
    read -r response
    
    if [[ "$response" =~ ^[Yy]$ ]]; then
        echo ""
        echo "🚀 Running migration..."
        supabase db push --file "$MIGRATION_FILE"
        echo ""
        echo "✅ Migration complete!"
    else
        echo ""
        echo "📝 To run manually, execute:"
        echo "   supabase db push --file $MIGRATION_FILE"
    fi
else
    echo "ℹ️  Supabase CLI not found"
    echo ""
    echo "📝 To run the migration:"
    echo ""
    echo "Option 1: Install Supabase CLI"
    echo "   npm install -g supabase"
    echo "   supabase login"
    echo "   supabase link --project-ref YOUR_PROJECT_REF"
    echo "   supabase db push --file $MIGRATION_FILE"
    echo ""
    echo "Option 2: Run in Supabase Dashboard"
    echo "   1. Go to your Supabase project"
    echo "   2. Navigate to SQL Editor"
    echo "   3. Copy and paste the contents of:"
    echo "      $MIGRATION_FILE"
    echo "   4. Click 'Run'"
    echo ""
fi

echo ""
echo "📖 For more details, see: PROFESSOR_LOCK_WEB_SETUP.md"
echo ""
