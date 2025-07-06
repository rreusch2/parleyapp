#!/bin/bash

# Enhanced Daily Insights Pipeline for ParleyApp  
# Professor Lock analyzes real upcoming games + uses web search + Baseball Savant scraping

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${BLUE}[$(date '+%Y-%m-%d %H:%M:%S')] $1${NC}"
}

print_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

# Check if required environment variables are set
check_env_vars() {
    print_status "Checking environment variables..."
    
    if [ -z "$SUPABASE_URL" ]; then
        print_error "SUPABASE_URL environment variable is not set"
        exit 1
    fi
    
    if [ -z "$SUPABASE_ANON_KEY" ]; then
        print_error "SUPABASE_ANON_KEY environment variable is not set"
        exit 1
    fi
    
    print_success "Environment variables are set"
}

# Install Python dependencies if needed
setup_python_deps() {
    print_status "Setting up Python dependencies..."
    
    if [ ! -f "requirements.txt" ]; then
        print_error "requirements.txt not found"
        exit 1
    fi
    
    # Create virtual environment if it doesn't exist
    if [ ! -d "venv" ]; then
        print_status "Creating Python virtual environment..."
        python3 -m venv venv
    fi
    
    # Activate virtual environment
    source venv/bin/activate
    
    # Install/update dependencies
    pip install -r requirements.txt > /dev/null 2>&1
    
    print_success "Python dependencies ready"
}

# Run intelligent Professor Lock insights generation
run_data_scraper() {
    print_status "🤖 Professor Lock analyzing upcoming games with web research..."
    
    if [ ! -f "enhanced_intelligent_insights.py" ]; then
        print_error "enhanced_intelligent_insights.py not found"
        exit 1
    fi
    
    # Activate virtual environment
    source venv/bin/activate
    
    # Run the enhanced insights generator
    if python3 enhanced_intelligent_insights.py; then
        print_success "Enhanced insights generation completed successfully"
    else
        print_error "Enhanced insights generation failed"
        exit 1
    fi
}

# Wait for backend to be ready
wait_for_backend() {
    print_status "Checking if backend is ready..."
    
    BACKEND_URL=${BACKEND_URL:-"http://localhost:3001"}
    MAX_ATTEMPTS=30
    ATTEMPT=1
    
    while [ $ATTEMPT -le $MAX_ATTEMPTS ]; do
        if curl -s "${BACKEND_URL}/health" > /dev/null 2>&1; then
            print_success "Backend is ready"
            return 0
        fi
        
        print_status "Waiting for backend... (attempt $ATTEMPT/$MAX_ATTEMPTS)"
        sleep 2
        ATTEMPT=$((ATTEMPT + 1))
    done
    
    print_warning "Backend not responding, continuing anyway..."
}

# Run the insights generator with Professor Lock
run_insights_generator() {
    print_status "Running Professor Lock insights generator..."
    
    if [ ! -f "daily_insights_generator.py" ]; then
        print_error "daily_insights_generator.py not found"
        exit 1
    fi
    
    # Activate virtual environment
    source venv/bin/activate
    
    # Run the insights generator
    if python3 daily_insights_generator.py; then
        print_success "Insights generation completed successfully"
    else
        print_error "Insights generation failed"
        exit 1
    fi
}

# Cleanup function
cleanup() {
    if [ -f "venv/bin/activate" ]; then
        deactivate 2>/dev/null || true
    fi
}

# Set trap for cleanup
trap cleanup EXIT

# Main execution
main() {
    print_status "🚀 Starting Daily Insights Pipeline for ParleyApp"
    echo
    
    # Check prerequisites
    check_env_vars
    
    # Setup Python environment
    setup_python_deps
    
    echo
    print_status "🚀 Enhanced Professor Lock Insights Generation"
    print_status "🎯 Real games + web search + Baseball Savant advanced metrics"
    wait_for_backend
    run_data_scraper
    
    echo
    print_success "🎯 Intelligent Daily Insights Pipeline completed successfully!"
    print_status "Fresh research-based insights are now available in the app"
    
    # Optional: Show summary
    source venv/bin/activate
    python3 -c "
from supabase import create_client
import os
from datetime import date

supabase = create_client(os.getenv('SUPABASE_URL'), os.getenv('SUPABASE_ANON_KEY'))
today = date.today().isoformat()

# Count insights generated
insights = supabase.table('daily_professor_insights').select('id').eq('date_generated', today).execute()

print(f'🚀 Generated {len(insights.data)} enhanced insights using Professor Lock + web search + Baseball Savant')
"
}

# Run if executed directly
if [ "${BASH_SOURCE[0]}" == "${0}" ]; then
    main "$@"
fi 