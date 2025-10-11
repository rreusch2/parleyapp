# NHL Support Added to teams_enhanced.py Script

## Problem
The `teams_enhanced.py` script didn't support NHL as a sport option:
```bash
python teams_enhanced.py --tomorrow --sport NHL
# Error: invalid choice: 'NHL' (choose from 'NFL', 'MLB', 'WNBA', 'CFB', 'MMA', 'UFC')
```

Even though there are **14 NHL games** in the database ready for picks!

## Solution
Added full NHL support to the script in 6 key places:

### 1. Command Line Argument (Line 1890)
```python
parser.add_argument('--sport', type=str, choices=['NFL', 'NHL', 'MLB', 'WNBA', 'CFB', 'MMA', 'UFC'])
```

### 2. Sport Order List (Line 614)
```python
sport_order = ["NFL", "NHL", "MLB", "WNBA", "CFB", "MMA"]
```

### 3. Sport Counts Initialization (Line 506)
```python
sport_counts = {"MLB": 0, "NHL": 0, "WNBA": 0, "MMA": 0, "NFL": 0, "CFB": 0}
```

### 4. Sport Name Mapping (Line 517-518)
```python
elif sport == "National Hockey League":
    sport_counts["NHL"] += 1
```

### 5. Distribution Initialization (Line 525)
```python
distribution = {"MLB": 0, "NHL": 0, "WNBA": 0, "MMA": 0, "NFL": 0, "CFB": 0}
```

### 6. Sport Priority for Storage (Lines 390-391)
```python
elif sport == "NHL":
    return 3  # Save third (WNBA → MLB → NHL → CFB → NFL)
```

### 7. Remaining Picks Allocation (Line 570)
```python
for sport in ["MMA", "CFB", "NHL"]:  # Include NHL in remaining picks
```

## Database Status
✅ **14 NHL Games Available**
- Earliest: Oct 9, 2025 at 11:10 PM UTC
- Latest: Oct 10, 2025 at 2:10 AM UTC
- Sport Name: "National Hockey League"

## Usage
Now you can generate NHL picks with:

```bash
# Generate NHL picks for tomorrow
python teams_enhanced.py --tomorrow --sport NHL

# Generate NHL picks for today
python teams_enhanced.py --sport NHL

# Generate NHL picks for specific date
python teams_enhanced.py --date 2025-10-09 --sport NHL

# Generate mixed picks (NHL will be included automatically)
python teams_enhanced.py --tomorrow --picks 15
```

## Storage Priority
Picks are stored in this order (so they display newest-first in the app):
1. WNBA (saved first, displays last)
2. MLB (saved second)
3. **NHL (saved third)** ← NEW!
4. CFB (saved fourth)
5. NFL (saved last, displays first)

---
**Fixed**: October 8, 2025
**Files Modified**: `teams_enhanced.py`
**Lines Changed**: 7 locations

