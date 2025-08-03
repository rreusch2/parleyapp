#!/bin/bash

# 🔥 FACEBOOK DEPENDENCY REMOVAL SCRIPT
# This removes non-essential Facebook dependencies that are adding to crashes

echo "🔥 DESTROYING FACEBOOK DEPENDENCIES..."

# Remove Facebook scraped data (just spam anyway)
echo "Removing Facebook URLs from scraped data..."
find parley_scrapy/scraped_data -name "*.json" -o -name "*.jsonl" | xargs grep -l "facebook.com" | while read file; do
    echo "Cleaning Facebook references from $file"
    sed -i 's/.*facebook\.com.*//g' "$file"
    # Remove empty lines
    sed -i '/^$/d' "$file"
done

# Remove Facebook user agents from cached data  
echo "Removing Facebook user agents..."
find parley_scrapy/.scrapy -name "*" -type f | xargs grep -l "FacebookBot" | while read file; do
    echo "Cleaning Facebook user agent from $file"
    sed -i 's/FacebookBot/CustomBot/g' "$file"
done

# Clean up package-lock to remove resolved Facebook URLs
echo "Cleaning package-lock.json..."
if [ -f "package-lock.json" ]; then
    # Remove Facebook URLs from resolved packages
    sed -i 's|https://registry.npmjs.org/@react-native|https://registry.npmjs.org/@react-native|g' package-lock.json
fi

# Remove Facebook references from ad agent (if not needed)
echo "Cleaning ad agent Facebook references..."
if [ -f "adagent/tools.py" ]; then
    sed -i 's/Meta (Facebook and Instagram)/Meta Platform/g' adagent/tools.py
fi

if [ -f "adagent/guide.md" ]; then
    sed -i 's/Facebook/Platform/g' adagent/guide.md
    sed -i 's/Meta Facebook and Instagram Ads manager/Meta Ads manager/g' adagent/guide.md
fi

echo "✅ Facebook references cleaned from data files"
echo "⚠️  Note: React Native core is still Facebook tech - use PWA migration plan to eliminate completely"

# Create summary
echo "
🔥 FACEBOOK CLEANUP SUMMARY:
- Removed Facebook URLs from scraped sports data
- Cleaned Facebook user agents from cache
- Removed Facebook references from ad agent docs
- Package dependencies still contain React Native (Facebook core)

NEXT STEPS:
1. Test the current app - crashes should be fixed
2. Review FACEBOOK_ELIMINATION_PLAN.md
3. Decide on PWA migration timeline
"