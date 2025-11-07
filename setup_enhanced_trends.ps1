# Enhanced Trends Setup Script
# Run this script to complete the enhanced trends implementation

Write-Host "🚀 Setting up Enhanced Trends for Predictive Play" -ForegroundColor Green
Write-Host "=============================================" -ForegroundColor Green

# Step 1: Replace trends.tsx with enhanced version
Write-Host "`n📱 Step 1: Updating mobile trends screen..." -ForegroundColor Yellow
$trendsPath = "C:\Users\reidr\parleyapp\apps\mobile\app\(tabs)\trends.tsx"
if (Test-Path $trendsPath) {
    Write-Host "   ⚠️  Please manually replace the contents of $trendsPath with the enhanced version provided above" -ForegroundColor Yellow
} else {
    Write-Host "   ❌ Trends file not found at $trendsPath" -ForegroundColor Red
}

# Step 2: Install Python dependencies for database population
Write-Host "`n🐍 Step 2: Installing Python dependencies..." -ForegroundColor Yellow
Set-Location "C:\Users\reidr\parleyapp\scripts"
try {
    pip install -r requirements_trends.txt
    Write-Host "   ✅ Python dependencies installed" -ForegroundColor Green
} catch {
    Write-Host "   ❌ Failed to install Python dependencies: $($_.Exception.Message)" -ForegroundColor Red
}

# Step 3: Install backend dependencies
Write-Host "`n🔧 Step 3: Installing backend dependencies..." -ForegroundColor Yellow
Set-Location "C:\Users\reidr\parleyapp\apps\backend"
try {
    if (!(Test-Path "node_modules\cors")) {
        npm install cors
        Write-Host "   ✅ CORS installed" -ForegroundColor Green
    } else {
        Write-Host "   ✅ CORS already installed" -ForegroundColor Green
    }
    
    if (!(Test-Path "node_modules\express")) {
        npm install express
        Write-Host "   ✅ Express installed" -ForegroundColor Green
    } else {
        Write-Host "   ✅ Express already installed" -ForegroundColor Green
    }
} catch {
    Write-Host "   ❌ Failed to install backend dependencies: $($_.Exception.Message)" -ForegroundColor Red
}

# Step 4: Set up environment variables
Write-Host "`n🔐 Step 4: Environment variables check..." -ForegroundColor Yellow
$envPath = "C:\Users\reidr\parleyapp\apps\backend\.env"
if (Test-Path $envPath) {
    $envContent = Get-Content $envPath -Raw
    if ($envContent -like "*SUPABASE_URL*" -and $envContent -like "*SUPABASE_SERVICE_ROLE_KEY*") {
        Write-Host "   ✅ Supabase environment variables found" -ForegroundColor Green
    } else {
        Write-Host "   ⚠️  Please ensure SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are set in .env" -ForegroundColor Yellow
    }
} else {
    Write-Host "   ⚠️  Backend .env file not found - please create it with Supabase credentials" -ForegroundColor Yellow
}

# Step 5: Populate trends database
Write-Host "`n📊 Step 5: Database population..." -ForegroundColor Yellow
Set-Location "C:\Users\reidr\parleyapp\scripts"

# Check if Supabase password is set
if ($env:SUPABASE_DB_PASSWORD) {
    Write-Host "   ✅ SUPABASE_DB_PASSWORD environment variable is set" -ForegroundColor Green
    
    # Run the population script
    try {
        python populate_trends_data.py
        Write-Host "   ✅ Trends database populated successfully" -ForegroundColor Green
    } catch {
        Write-Host "   ❌ Failed to populate database: $($_.Exception.Message)" -ForegroundColor Red
        Write-Host "   💡 You can run this manually later: python populate_trends_data.py" -ForegroundColor Cyan
    }
} else {
    Write-Host "   ⚠️  SUPABASE_DB_PASSWORD not set as environment variable" -ForegroundColor Yellow
    Write-Host "   💡 Set it with: `$env:SUPABASE_DB_PASSWORD='your_password'" -ForegroundColor Cyan
    Write-Host "   💡 Then run: python populate_trends_data.py" -ForegroundColor Cyan
}

# Step 6: Final instructions
Write-Host "`n🎯 Setup Complete! Next Steps:" -ForegroundColor Green
Write-Host "================================" -ForegroundColor Green
Write-Host ""
Write-Host "1. 📱 Mobile App:"
Write-Host "   • Replace trends.tsx content with the enhanced version (see above)"
Write-Host "   • The enhanced trends should now be active on your Trends tab"
Write-Host ""
Write-Host "2. 🚀 Backend API:"
Write-Host "   • Start your backend: cd apps\backend && npm start"
Write-Host "   • Trends API will be available at /api/trends/enhanced"
Write-Host ""
Write-Host "3. 📊 Database:"
if ($env:SUPABASE_DB_PASSWORD) {
    Write-Host "   • ✅ Trends data populated successfully"
} else {
    Write-Host "   • ⚠️  Run database population: set SUPABASE_DB_PASSWORD and run populate_trends_data.py"
}
Write-Host ""
Write-Host "4. 🧪 Testing:"
Write-Host "   • Open your mobile app and navigate to Trends tab"
Write-Host "   • You should see enhanced cards with AI insights and charts"
Write-Host "   • Check browser tools for any errors"
Write-Host ""
Write-Host "🎉 Your Enhanced Trends are ready to crush the competition!" -ForegroundColor Green

# Return to original directory
Set-Location "C:\Users\reidr\parleyapp"
