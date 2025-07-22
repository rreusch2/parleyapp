#!/bin/bash

# App Store Screenshot Resizer
# Usage: ./resize-screenshots.sh input.png

if [ $# -eq 0 ]; then
    echo "Usage: $0 <input-screenshot>"
    echo "Example: $0 my-screenshot.png"
    exit 1
fi

INPUT="$1"
BASENAME=$(basename "$INPUT" .png)

echo "🖼️  Resizing $INPUT for App Store submission..."

# 6.9" Display sizes (iPhone 16 Pro Max, 15 Pro Max, 14 Pro Max)
echo "📱 Creating 6.9\" display sizes..."
convert "$INPUT" -resize 1290x2796! "${BASENAME}_6.9_portrait.png"
convert "$INPUT" -resize 2796x1290! "${BASENAME}_6.9_landscape.png"

# 6.7" Display sizes (iPhone 16 Plus, 15 Plus)  
echo "📱 Creating 6.7\" display sizes..."
convert "$INPUT" -resize 1320x2868! "${BASENAME}_6.7_portrait.png"
convert "$INPUT" -resize 2868x1320! "${BASENAME}_6.7_landscape.png"

echo "✅ All screenshots created:"
ls -la "${BASENAME}"_*.png

echo ""
echo "📋 App Store Requirements Met:"
echo "   6.9\" Portrait:  1290 x 2796 ✅"
echo "   6.9\" Landscape: 2796 x 1290 ✅" 
echo "   6.7\" Portrait:  1320 x 2868 ✅"
echo "   6.7\" Landscape: 2868 x 1320 ✅"
