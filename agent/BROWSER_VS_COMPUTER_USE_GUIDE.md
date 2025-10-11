# Browser Use vs Computer Use - Quick Reference Guide

## Overview

Your agent has two automation tools that seem similar but serve different purposes. Here's when to use each.

## Browser Use Tool (`browser_use_tool.py`)

### What It Does
Automates **web browsers** (Chrome, Firefox) to interact with websites.

### Use Cases
✅ **Web scraping** - Extract data from websites
✅ **Sports betting sites** - Linemate.io, ESPN, DraftKings
✅ **Form filling** - Submit data to web forms
✅ **Web navigation** - Click links, scroll pages
✅ **Web research** - Search engines, multiple tabs
✅ **API alternatives** - When websites don't have APIs

### Key Features
- Navigate to URLs (`go_to_url`)
- Click elements by index (`click_element`)
- Input text into forms (`input_text`)
- Scroll pages (`scroll_down`, `scroll_up`)
- Extract content using AI (`extract_content`) - **Our main fix!**
- Search the web (`web_search`)
- Tab management (`open_tab`, `switch_tab`)
- Screenshot web pages

### Example: Linemate Scraping
```python
from app.tool.browser_use_tool import BrowserUseTool

tool = BrowserUseTool()

# Navigate to Linemate
await tool.execute(action="go_to_url", url="https://linemate.io/ncaaf/trends")

# Wait for page to load
await tool.execute(action="wait", seconds=5)

# Extract player trends
result = await tool.execute(
    action="extract_content",
    goal="Extract all player names, prop types, and hit rates from the left sidebar"
)

# Scroll for more
await tool.execute(action="scroll_down", scroll_amount=1200)
```

### When to Use
- ✅ Any time you need data from a **website**
- ✅ When you see a URL (http:// or https://)
- ✅ For Linemate, ESPN, team stats sites, etc.

### When NOT to Use
- ❌ Desktop applications (use Computer Use instead)
- ❌ Command-line tools
- ❌ Local file operations

---

## Computer Use Tool (`computer_use_tool.py`)

### What It Does
Automates **desktop GUI** applications by controlling mouse and keyboard.

### Use Cases
✅ **Desktop apps** - Excel, Word, Photoshop
✅ **Native applications** - Windows apps, Mac apps
✅ **System automation** - File explorer, system settings
✅ **GUI testing** - Click buttons in desktop apps
✅ **Screen automation** - When no API or web interface exists

### Key Features
- Move mouse (`move_to`)
- Click anywhere on screen (`click`)
- Type text (`typing`)
- Press keyboard keys (`press`, `hotkey`)
- Scroll desktop content (`scroll`)
- Drag and drop (`drag_to`)
- Screenshot desktop

### Example: Desktop Automation
```python
from app.tool.computer_use_tool import ComputerUseTool

tool = ComputerUseTool(sandbox)

# Click at screen coordinates
await tool.execute(action="click", x=500, y=300)

# Type text
await tool.execute(action="typing", text="Hello World")

# Press Enter
await tool.execute(action="press", key="enter")

# Take screenshot
await tool.execute(action="screenshot")
```

### When to Use
- ✅ Desktop applications only
- ✅ When you need to control the mouse/keyboard directly
- ✅ Native apps that don't have a web interface

### When NOT to Use
- ❌ Websites (use Browser Use instead)
- ❌ Any URL-based content
- ❌ Web scraping

---

## Quick Decision Tree

```
Need to get data?
├─ Is it from a website/URL?
│  └─ YES ➜ Use Browser Use Tool ✅
│
└─ Is it from a desktop app?
   └─ YES ➜ Use Computer Use Tool ✅
```

## Common Mistakes

### ❌ WRONG: Using Computer Use for Websites
```python
# DON'T DO THIS
tool = ComputerUseTool()
await tool.execute(action="click", x=100, y=200)  # Clicking blindly on screen
```
**Why wrong?** Websites change layout, screen coordinates break, unreliable

### ✅ RIGHT: Using Browser Use for Websites
```python
# DO THIS INSTEAD
tool = BrowserUseTool()
await tool.execute(action="go_to_url", url="https://linemate.io")
await tool.execute(action="extract_content", goal="Get player trends")
```
**Why right?** Browser automation understands web structure, more reliable

---

## For Linemate Specifically

### Always Use Browser Use Tool

Linemate.io is a **website**, so always use `browser_use_tool.py`.

The tool now has special Linemate handling:
1. Detects when URL contains "linemate.io"
2. Uses specialized extraction prompt
3. Focuses on left sidebar where players are listed
4. Understands Linemate's structure

### How It Works Now

```python
# The tool automatically detects Linemate
tool = BrowserUseTool()
await tool.execute(action="go_to_url", url="https://linemate.io/ncaaf/trends")
await tool.execute(action="wait", seconds=5)  # Let JS load

# This now knows to look at the left sidebar for player cards
result = await tool.execute(
    action="extract_content",
    goal="Extract player trends"
)

# Result will have player names, prop types, hit rates, trends
```

The extraction prompt now tells the AI:
- "Players are in the LEFT SIDEBAR"
- "Look for player cards with names, props, hit rates"
- "Extract EVERY player, not just examples"

---

## Summary Table

| Feature | Browser Use | Computer Use |
|---------|-------------|--------------|
| **Target** | Websites | Desktop Apps |
| **Input** | URLs | Screen coordinates |
| **Reliability** | High | Medium |
| **For Linemate** | ✅ YES | ❌ NO |
| **For ESPN** | ✅ YES | ❌ NO |
| **For Excel** | ❌ NO | ✅ YES |
| **Screenshots** | Web pages | Full desktop |
| **Element Selection** | By index/CSS | By coordinates |

---

## Key Takeaway

🌐 **Website/URL** = Browser Use Tool
🖥️ **Desktop App** = Computer Use Tool
🏈 **Linemate/Sports Sites** = Browser Use Tool ✅

For your betting app, you'll almost always use Browser Use Tool since you're getting data from websites (Linemate, ESPN, etc.).

