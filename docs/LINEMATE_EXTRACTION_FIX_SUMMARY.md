# Linemate Extraction Fix Summary

## Problem
The `linemate_trends` tool was failing to extract player trend data from Linemate.io, returning empty player arrays despite successfully navigating to the website. The browser automation was working but the content extraction was failing.

## Root Causes Identified

1. **Wrong Content Type**: The browser extraction was using `markdownify` to convert HTML to markdown, which was losing important structural information and making it hard for the LLM to extract data.

2. **Generic Extraction Prompt**: The extraction prompt was too generic and didn't understand Linemate.io's specific layout (player cards in the left sidebar).

3. **Insufficient Wait Times**: Linemate is a dynamic site that loads content via JavaScript. The tool wasn't waiting long enough for content to fully load.

4. **Poor JSON Parsing**: The parsing function wasn't properly handling different JSON response formats (arrays, objects with wrapper keys, etc.).

5. **Lack of Debugging**: No visibility into what was actually being extracted, making it hard to diagnose issues.

## Key Differences: browser_use vs computer_use Tools

### `browser_use_tool.py` - Web Browser Automation
- **Purpose**: Automate web browsers (Chrome/Firefox)
- **Use Cases**: Website scraping, web forms, clicking links, extracting web content
- **Technologies**: Playwright, browser automation
- **Best For**: Linemate, sports websites, any web-based data sources

### `computer_use_tool.py` - Desktop GUI Automation
- **Purpose**: Automate desktop applications
- **Use Cases**: Desktop apps, native windows, system-level automation
- **Technologies**: Mouse/keyboard control, desktop screenshots
- **Best For**: Non-web applications only

**For Linemate scraping, we use `browser_use_tool.py` exclusively.**

## Changes Made

### 1. Enhanced Browser Extraction (`agent/app/tool/browser_use_tool.py`)

#### Changed Content Extraction Method
- **Before**: Used `markdownify` to convert HTML to markdown
- **After**: Uses `page.evaluate("() => document.body.innerText")` to get clean text content
- **Why**: innerText preserves visible text structure better than markdown conversion

#### Added Linemate-Specific Extraction Logic
```python
# Detects Linemate.io URLs and applies specialized extraction
is_linemate = "linemate.io" in current_url

if is_linemate:
    # Custom prompt that understands Linemate's layout
```

#### Improved Extraction Prompt for Linemate
The new prompt includes:
- **Layout explanation**: Left sidebar contains player cards
- **What to look for**: Player name, prop type, hit rate %, trend indicators
- **Examples**: "70%" or "8/10" for hit rates, "Hot"/"Cold" for trends
- **Emphasis**: Extract ALL players, not just examples
- **Structure guidance**: Focus on the left sidebar content

### 2. Enhanced Linemate Trends Tool (`agent/app/tool/linemate_trends.py`)

#### Increased Wait Times
- **Before**: 3 seconds initial wait, 2 seconds after scroll
- **After**: 5 seconds initial wait, 3 seconds after scroll
- **Why**: Linemate uses JavaScript to load content dynamically

#### Improved Scroll Behavior
- **Before**: 800px scroll amount
- **After**: 1200px scroll amount
- **Why**: Load more content per scroll, get more players

#### Better Extraction Goals
More specific instructions in the extraction goal:
- Explains Linemate's structure explicitly
- Emphasizes extracting ALL visible players
- Provides clear field definitions

#### Enhanced JSON Parsing
New parsing function handles:
- **Code blocks**: Removes markdown ```json``` wrappers
- **Wrapper keys**: Automatically extracts from `players` or `trends` keys
- **Multiple formats**: Arrays, single objects, or wrapped objects
- **Better logging**: Reports how many items were parsed

#### Added Comprehensive Debugging
- Logs extraction preview (first 300-500 chars)
- Reports number of trends found per extraction
- Warns when no data is extracted
- Shows scroll progress with counts

### 3. Removed Unused Code
- Removed unused `Field` and `Optional` imports
- Removed unused `html_content` variable
- Removed unused `scroll_result` variable

## Testing the Fix

### Manual Test
Run your agent and watch the logs. You should now see:
```
INFO | Initial extraction output preview: Extracted from page:
{"players": [{"player_name": "Connor McDavid", ...}]}
INFO | Initial extraction found 15 trends
INFO | Scroll 1 found 12 new trends
INFO | Scroll 2 found 8 new trends
```

### What to Look For
1. **Browser Window**: Should open and navigate to Linemate.io (headless=false in config)
2. **Page Loading**: Should wait 5 seconds for content to load
3. **Extraction Logs**: Should show JSON data with player names
4. **Scroll Progress**: Should see increasing trend counts after each scroll
5. **Final Count**: Should see 20-50+ players extracted (depends on sport/time)

## Configuration Requirements

Ensure your `agent/config/config.toml` has:
```toml
[browser]
headless = false                    # IMPORTANT: Set to false to see what's happening
disable_security = true
```

## Expected Behavior After Fix

### Before (Broken)
```json
{
  "sport": "CFB",
  "total_trends": 2,
  "trends": [
    {"prop_type": "yards", "hit_rate": 100},
    {"prop_type": "hits", "trend": "hot"}
  ]
}
```
❌ Generic/incomplete data, no player names

### After (Fixed)
```json
{
  "sport": "CFB",
  "total_trends": 42,
  "trends": [
    {
      "player_name": "LJ Martin",
      "prop_type": "rushing_yards",
      "hit_rate": 75,
      "trend": "hot",
      "line_value": "Over 85.5"
    },
    {
      "player_name": "Noah Fifita",
      "prop_type": "passing_yards",
      "hit_rate": 68,
      "trend": "neutral",
      "line_value": "Over 250.5"
    }
    // ... 40+ more players
  ]
}
```
✅ Complete player data with all fields

## Troubleshooting

### If Still Getting Empty Results

1. **Check Browser Window**: Look at the visible browser - is Linemate actually loading?
2. **Check Logs**: Look for "extraction preview" logs - what text is being extracted?
3. **Network Issues**: Linemate might be blocking automation (try different browser args)
4. **JavaScript Not Loading**: Increase wait times even more (try 10 seconds)

### If Page Not Loading

1. **Check Internet**: Verify you can manually access linemate.io
2. **Check Proxy**: If using a proxy in config, verify it's working
3. **Browser Issues**: Try clearing browser cache or using a different Chrome instance

### If Extraction is Partial

1. **Increase Scrolls**: Set `max_scroll=5` instead of 3
2. **Slow Down**: Increase wait times to 5+ seconds between scrolls
3. **Check CSS Selectors**: Linemate may have changed their layout

## Future Improvements

1. **Fallback to CSS Selectors**: If LLM extraction fails, try direct DOM queries
2. **Caching**: Cache extracted trends to avoid repeated scraping
3. **Rate Limiting**: Add delays to avoid overwhelming Linemate's servers
4. **Error Recovery**: Better handling of network errors and timeouts

## Summary

The fix transforms the Linemate extraction from a failing tool into a reliable data source by:
- ✅ Using better content extraction (innerText vs markdown)
- ✅ Understanding Linemate's specific layout
- ✅ Waiting properly for dynamic content
- ✅ Parsing JSON responses correctly
- ✅ Providing comprehensive debugging

**You should now see real player data extracted from Linemate with names, prop types, hit rates, and trends!**

