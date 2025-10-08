# 🏆 League Logos Setup Guide

## 📋 Quick Summary

**Perfect Logo Specs:**
- **Format**: PNG with transparent background
- **Size**: 512x512px (or 256x256px for smaller files)
- **File Size**: Under 50KB each (use compression)
- **Naming**: `mlb.png`, `nba.png`, etc. (lowercase)

---

## 🎨 Logo Requirements

### **Why These Specs?**

| Spec | Why It Matters |
|------|----------------|
| **512x512px** | Standard app icon size, scales perfectly on all devices |
| **PNG transparent** | Works on any background/theme without white boxes |
| **Under 50KB** | Fast loading, smooth user experience |
| **Optimized** | Use TinyPNG.com to compress without quality loss |

### **Size Comparison:**
- ❌ **800x800**: Too large for mobile (100-200KB files)
- ✅ **512x512**: Perfect (30-50KB optimized)
- ✅ **256x256**: Also good (15-30KB smaller files)
- ❌ **128x128**: Too small (pixelated on high-DPI screens)

---

## 📁 Supabase Storage Structure

### **Bucket: `logos`**
```
logos/
├── bookmakers/
│   ├── draftkings.png   ✅ Already uploaded
│   ├── fanduel.png      ✅ Already uploaded
│   ├── betmgm.png       ✅ Already uploaded
│   ├── caesars.png      ✅ Already uploaded
│   └── fanatics.png     ✅ Already uploaded
└── leagues/             🆕 Create this folder
    ├── mlb.png
    ├── nba.png
    ├── nfl.png
    ├── nhl.png
    ├── wnba.png
    ├── cfb.png
    ├── mls.png
    └── ufc.png
```

### **Public URLs Will Be:**
```
https://iriaegoipkjtktitpary.supabase.co/storage/v1/object/public/logos/leagues/mlb.png
https://iriaegoipkjtktitpary.supabase.co/storage/v1/object/public/logos/leagues/nba.png
https://iriaegoipkjtktitpary.supabase.co/storage/v1/object/public/logos/leagues/nfl.png
...etc
```

---

## 🔍 Where to Get Official Logos

### **Option 1: Sports Logos Database** (Recommended)
- **Site**: https://www.sportslogos.net/
- **Format**: High-quality PNGs with transparent backgrounds
- **Download**: Free for personal use
- **Leagues Available**: MLB, NBA, NFL, NHL, CFB, etc.

### **Option 2: Official League Websites**
- **MLB**: mlb.com (media/press kit)
- **NBA**: nba.com (media resources)
- **NFL**: nfl.com (logos section)
- **NHL**: nhl.com (media)
- **WNBA**: wnba.com
- **CFB**: ncaa.com

### **Option 3: Wikimedia Commons** (Free to use)
- **URL**: commons.wikimedia.org
- Search: "MLB logo", "NBA logo", etc.
- Look for official league logos (not team logos)
- Usually in SVG or high-res PNG

### **Option 4: LogoLounge / Brandfetch** (API option later)
- Can automate logo fetching
- Higher quality, always up-to-date

---

## 📤 Upload Steps (Supabase Dashboard)

### **Step 1: Access Storage**
1. Go to: https://supabase.com/dashboard/project/iriaegoipkjtktitpary/storage/buckets/logos
2. Navigate to the `logos` bucket

### **Step 2: Create `leagues` Folder**
1. Click "Create folder"
2. Name it: `leagues`
3. Confirm

### **Step 3: Upload Logos**
1. Open the `leagues` folder
2. Click "Upload file"
3. Select your optimized PNG files:
   - `mlb.png`
   - `nba.png`
   - `nfl.png`
   - `nhl.png`
   - `wnba.png`
   - `cfb.png`
   - `mls.png`
   - `ufc.png`
4. Upload all at once

### **Step 4: Verify Public Access**
The `logos` bucket should already be public. Verify by clicking any logo and checking the URL format:
```
https://iriaegoipkjtktitpary.supabase.co/storage/v1/object/public/logos/leagues/mlb.png
```

If you see `sign` or `auth` in the URL, the bucket isn't public. Fix:
1. Go to bucket settings
2. Set visibility to "Public"

---

## 🗄️ Database Setup (Optional but Recommended)

Create a `league_logos` table to track logos and metadata:

```sql
CREATE TABLE IF NOT EXISTS league_logos (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  league_key VARCHAR(10) UNIQUE NOT NULL, -- 'MLB', 'NBA', etc.
  league_name VARCHAR(100) NOT NULL,
  logo_url TEXT NOT NULL,
  logo_size INT, -- File size in bytes
  brand_color VARCHAR(7), -- Hex color like '#002D72'
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert league data
INSERT INTO league_logos (league_key, league_name, logo_url, brand_color) VALUES
('MLB', 'Major League Baseball', 'https://iriaegoipkjtktitpary.supabase.co/storage/v1/object/public/logos/leagues/mlb.png', '#002D72'),
('NBA', 'National Basketball Association', 'https://iriaegoipkjtktitpary.supabase.co/storage/v1/object/public/logos/leagues/nba.png', '#C8102E'),
('NFL', 'National Football League', 'https://iriaegoipkjtktitpary.supabase.co/storage/v1/object/public/logos/leagues/nfl.png', '#013369'),
('NHL', 'National Hockey League', 'https://iriaegoipkjtktitpary.supabase.co/storage/v1/object/public/logos/leagues/nhl.png', '#000000'),
('WNBA', 'Women''s National Basketball Association', 'https://iriaegoipkjtktitpary.supabase.co/storage/v1/object/public/logos/leagues/wnba.png', '#FF6600'),
('CFB', 'College Football', 'https://iriaegoipkjtktitpary.supabase.co/storage/v1/object/public/logos/leagues/cfb.png', '#862633'),
('MLS', 'Major League Soccer', 'https://iriaegoipkjtktitpary.supabase.co/storage/v1/object/public/logos/leagues/mls.png', '#C39E6D'),
('UFC', 'Ultimate Fighting Championship', 'https://iriaegoipkjtktitpary.supabase.co/storage/v1/object/public/logos/leagues/ufc.png', '#D20A0A')
ON CONFLICT (league_key) DO UPDATE SET
  logo_url = EXCLUDED.logo_url,
  brand_color = EXCLUDED.brand_color,
  updated_at = NOW();

-- Add index
CREATE INDEX IF NOT EXISTS idx_league_logos_key ON league_logos(league_key);
```

---

## 🎨 Logo Optimization Tips

### **Before Uploading:**

1. **Resize to 512x512**:
   - Use Photoshop, GIMP, or online tool (iloveimg.com)
   - Maintain aspect ratio (may need to center on canvas)

2. **Optimize File Size** (TinyPNG.com):
   - Upload your 512x512 PNG
   - Download the compressed version
   - Should reduce from 100-200KB → 30-50KB
   - No visible quality loss

3. **Verify Transparency**:
   - Open in image viewer
   - Check for white/gray boxes around logo
   - Should have checkerboard pattern (transparent)

4. **Test on Dark Background**:
   - Some logos have white elements that disappear
   - May need to add subtle stroke/glow if needed

---

## 💻 Code Updates Needed

### **1. Update leagueLogos.ts utility** (Already created!)

The utility at `app/utils/leagueLogos.ts` is ready. Just uncomment the `logoUrl` lines:

```typescript
MLB: {
  key: 'MLB',
  name: 'Major League Baseball',
  emoji: '⚾',
  color: '#002D72',
  logoUrl: 'https://iriaegoipkjtktitpary.supabase.co/storage/v1/object/public/logos/leagues/mlb.png'
},
// ... repeat for all leagues
```

### **2. PropPredictionCard is ready!**

Your card already has the code to display league logos. It will automatically show:
- League logo if `logoUrl` is available
- Emoji fallback if not

---

## ✅ Testing Checklist

After uploading logos:

- [ ] Upload all 8 league logo PNGs to `logos/leagues/` folder
- [ ] Verify logos are publicly accessible (paste URL in browser)
- [ ] Uncomment `logoUrl` in `app/utils/leagueLogos.ts`
- [ ] Test PropPredictionCard shows logos correctly
- [ ] Test on different themes (Elite Default, Midnight Aqua, etc.)
- [ ] Verify logos look good on dark backgrounds
- [ ] Check file sizes (should be under 50KB each)
- [ ] Verify transparent backgrounds (no white boxes)

---

## 🎯 Example: MLB Logo

**Before optimization:**
- Size: 1024x1024px
- File size: 180KB
- Format: PNG with transparency

**After optimization:**
- Size: 512x512px
- File size: 35KB (compressed via TinyPNG)
- Format: PNG with transparency
- Quality: Indistinguishable from original

**Result**: Loads 5x faster, looks identical! ✨

---

## 🚀 After Upload

Once you've uploaded the logos, I'll:
1. Update the `leagueLogos.ts` utility with real URLs
2. Optionally add the `league_logos` table to database
3. Test the PropPredictionCard with real league logos
4. Ensure everything displays beautifully across all themes

---

## 📝 Quick Reference

| League | File Name | Recommended Source |
|--------|-----------|-------------------|
| MLB | `mlb.png` | sportslogos.net |
| NBA | `nba.png` | sportslogos.net |
| NFL | `nfl.png` | sportslogos.net |
| NHL | `nhl.png` | sportslogos.net |
| WNBA | `wnba.png` | wnba.com |
| CFB | `cfb.png` | ncaa.com |
| MLS | `mls.png` | sportslogos.net |
| UFC | `ufc.png` | ufc.com |

---

## 🎉 Final Notes

- **512x512px transparent PNG** is the sweet spot
- **TinyPNG.com** for compression (free, no signup)
- **sportslogos.net** has the best quality logos
- Upload to `logos/leagues/` in Supabase
- Your card is already coded to display them!

**Ready to make those cards even more premium!** 🔥

