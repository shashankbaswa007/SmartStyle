# Wear Tracking & Insights System

## Overview
The enhanced wear tracking system provides meaningful insights about wardrobe usage patterns, helping users make informed decisions about what to wear, what to rotate in, and which items need more attention. The system surfaces actionable recommendations without overwhelming users with analytics.

## Data Model
The system uses existing data fields (no schema changes):
- `wornCount` - Total number of times worn
- `lastWornDate` - Timestamp of last wear
- `addedDate` - Timestamp when item was added
- `itemType` - Category (top, bottom, dress, shoes, accessory, outerwear)
- `season` - Season tags (spring, summer, fall, winter)
- `occasions` - Occasion tags (casual, formal, party, business, sports)

## Smart Insights Panel

### Insight Types (Prioritized)

#### 1. **Overused Items** 🔥
**Trigger**: Items worn >2x average AND ≥8 times total
**Purpose**: Identify wardrobe MVPs that may need backup/similar items
**Example**: "High rotation item: Blue blazer has been worn 12 times — consider adding similar items"
**Color**: Amber
**Icon**: TrendingUp

#### 2. **Rotation Suggestions** 🔄
**Trigger**: Items worn 1-2 times but not in past month
**Purpose**: Suggest underutilized items to refresh style
**Example**: "Rotation suggestion: Try wearing black leather jacket this week to refresh your style"
**Color**: Purple
**Icon**: Sparkles

#### 3. **Category Imbalance** ℹ️
**Trigger**: Item type with ≥2 items but avg <1 wear per item
**Purpose**: Highlight underused categories
**Example**: "Underused dresses: You have 4 dresses that rarely get worn — time to mix them in?"
**Color**: Teal
**Icon**: Info

#### 4. **Seasonal Opportunities** ☀️
**Trigger**: ≥2 seasonal items for current season not worn in 2+ weeks
**Purpose**: Remind about seasonal items while they're relevant
**Example**: "Perfect for summer: 5 summer items haven't been worn recently"
**Color**: Teal
**Icon**: CloudSun

#### 5. **Forgotten Items** ⏰
**Trigger**: Never worn items added >1 month ago
**Purpose**: Surface items that need attention
**Example**: "3 items still waiting: White sneakers, Red scarf and 1 more — give them a try!"
**Color**: Amber
**Icon**: Clock

#### 6. **Wardrobe MVP** ❤️
**Trigger**: Items worn ≥5 times (top 3)
**Purpose**: Celebrate favorites and acknowledge preferences
**Example**: "Wardrobe MVP: Navy jeans (8 wears) — a true favorite!"
**Color**: Rose
**Icon**: Heart

#### 7. **Past Favorites** 💜
**Trigger**: Items worn ≥2 times but not in 3+ months
**Purpose**: Reintroduce items that were once loved
**Example**: "Rediscover past favorites: 2 items you used to love — Green cardigan and more"
**Color**: Purple
**Icon**: Sparkles

### Insight Display
- **Collapsible Panel**: Expandable/collapsible to reduce clutter
- **Badge Count**: Shows number of active insights
- **Max 4 Insights**: Prevents overwhelming the user
- **Priority Order**: Most actionable insights shown first
- **Context-Aware**: Adapts to selected context mode (work, casual, etc.)

## Item Badges (Visual Indicators)

### Badge Types

#### High Usage 🔥
- **Condition**: Worn >2x average AND ≥8 times
- **Display**: "Nx" with fire emoji
- **Color**: Blue
- **Meaning**: Heavily relied upon item

#### Favorite ❤️
- **Condition**: Worn 5-7 times
- **Display**: "Nx" with heart emoji
- **Color**: Rose
- **Meaning**: Well-loved item

#### New ✨
- **Condition**: Never worn, added <7 days ago
- **Display**: "New"
- **Color**: Teal
- **Meaning**: Recent addition

#### Try Me! 👀
- **Condition**: Never worn, added >30 days ago
- **Display**: "Try me!"
- **Color**: Amber
- **Meaning**: Needs first wear

#### Unworn 📦
- **Condition**: Never worn, added 7-30 days ago
- **Display**: "Unworn"
- **Color**: Gray
- **Meaning**: Awaiting debut

#### Rotate In? 🔄
- **Condition**: Worn 1-2x but not in past month
- **Display**: "Rotate in?"
- **Color**: Purple
- **Meaning**: Good rotation candidate

#### Miss Me? 💜
- **Condition**: Worn ≥3x but not in 3+ months
- **Display**: "Miss me?"
- **Color**: Purple
- **Meaning**: Long-term neglected

#### Recent ✓
- **Condition**: Worn in past 2 weeks
- **Display**: "Recent"
- **Color**: Emerald
- **Meaning**: Currently in rotation

## Wear Info Tooltips

### Detailed Information
Hover over any badge to see:
- Total wear count
- Last worn date (relative: "worn 2 days ago", "worn 3 weeks ago")
- Addition date (if recent: "added this week", "added 2 weeks ago")

### Examples
- "Worn 5 times • worn 2 days ago"
- "Never worn • added 3 weeks ago"
- "Worn 1 time • worn 2 months ago • added this week"

## Calculation Methods

### Average Wear Count
```typescript
avgWearCount = totalWears / itemsWithWears
```
Used to identify overused and underused items relative to wardrobe.

### Time-Based Thresholds
- **Recent**: <2 weeks
- **Not Recent**: 2 weeks - 1 month
- **Neglected**: 1-3 months
- **Long-term neglected**: >3 months

### Wear Categories
- **Never**: wornCount = 0
- **Minimal**: wornCount = 1-2
- **Regular**: wornCount = 3-4
- **Favorite**: wornCount = 5-7
- **Heavy use**: wornCount ≥8

## UI/UX Design Principles

### Non-Intrusive
- Collapsible insights panel (user controls visibility)
- Max 4 insights at a time
- Subtle badges (not overwhelming)
- Tooltips on hover (detail on demand)

### Actionable
- Specific item names mentioned
- Clear suggestions ("try wearing X this week")
- Context-aware recommendations
- No vague analytics

### Visual Consistency
- Color coding by insight type
- Consistent icon usage
- Matches app's teal/emerald theme
- Professional, clean design

### Progressive Disclosure
- Brief insight in panel
- Full details in tooltip
- No charts or complex visualizations
- Plain language descriptions

## Integration with Existing Features

### Works With
✅ **Context Modes** - Insights adapt to work/casual/travel contexts
✅ **Item Type Filters** - Category balance considers filtered types
✅ **Search & Sort** - Badges visible on all filtered items
✅ **Mark as Worn** - Updates wear counts and recalculates insights
✅ **Color Grouping** - Badges show in grouped view

### Updates Automatically
- Real-time: When items marked as worn
- On load: When wardrobe data fetched
- On filter change: Context-specific insights recalculated

## Performance Considerations

### Efficient Calculations
- Client-side computations (no API calls)
- Memoized with React state
- Recalculates only on wardrobe changes
- O(n) complexity for n items

### Scalability
- Handles 100+ items efficiently
- Filtering reduces computation set
- Max 4 insights prevents render bloat

## Privacy & Data

### No External Tracking
- All calculations client-side
- No usage data sent to servers
- Insights generated locally
- User data stays private

### Data Preservation
- No new database fields required
- Uses existing data model
- Backward compatible
- No migration needed

## User Benefits

### Decision Support
- **What to wear today**: See recent wears, avoid repeats
- **Wardrobe gaps**: Identify underused categories
- **Rotation planning**: Get specific suggestions
- **Style diversity**: Encouraged to try neglected items

### Behavioral Insights
- **Favorites awareness**: Recognize go-to items
- **Forgotten items**: Rediscover purchases
- **Seasonal timing**: Maximize seasonal items
- **Balanced wear**: Avoid overusing single items

### Shopping Guidance
- **Duplicate needs**: High-use items need backups
- **Category gaps**: Underused types = wrong purchases?
- **Style preferences**: Data reveals actual preferences
- **Value assessment**: Low wears = reconsider similar items

## Future Enhancements

### Potential Additions
1. **Outfit Correlation** - Track which items worn together
2. **Weather Integration** - Suggest based on forecast
3. **Wear Goals** - Set targets for specific items
4. **Wear History Graph** - Visual timeline (optional)
5. **Export Reports** - Monthly wear summaries
6. **Sharing Insights** - Compare with friends (opt-in)

### User Requests
- Track reasons for not wearing items
- Remind about special occasion items
- Suggest items for upcoming events
- Track cost-per-wear metrics

## Technical Implementation

### Key Functions

**`getSmartInsights()`**
- Analyzes wardrobe items
- Generates 7 insight types
- Returns prioritized array (max 4)
- Context-aware filtering

**`getItemNudge(item)`**
- Evaluates single item
- Returns badge config or null
- Uses comparative analysis (vs avg)
- Multiple badge types

**`getWearInfo(item)`**
- Generates tooltip text
- Relative time descriptions
- Human-readable format
- Combines multiple data points

### State Dependencies
- `wardrobeItems` - Source data
- `contextMode` - Current filter context
- No additional state needed

### Re-computation Triggers
- Wardrobe items change
- Context mode change
- Item marked as worn
- Page load/refresh

## Accessibility

### Screen Readers
- ARIA labels on insights
- Badge meanings announced
- Tooltip content readable
- Semantic HTML structure

### Keyboard Navigation
- Tab to insights panel
- Enter to expand/collapse
- Arrow keys through insights
- Escape to close tooltips

### Visual
- High contrast badges
- Color-blind friendly (icons + text)
- Large touch targets (mobile)
- Clear typography

## Testing Scenarios

### Test Cases
1. ✅ Empty wardrobe (no insights)
2. ✅ New items only (appropriate nudges)
3. ✅ Balanced wardrobe (diverse insights)
4. ✅ Heavily used items (overuse detection)
5. ✅ Neglected items (rotation suggestions)
6. ✅ Seasonal items (timely reminders)
7. ✅ Context filtering (adapted insights)
8. ✅ Large wardrobe (performance)

### Edge Cases
- Item worn today (shows "worn today")
- Multiple items same wear count (stable sort)
- No seasonal tags (skips seasonal insights)
- All items worn equally (no overuse)
- Context with 0 items (context-empty insight)

## Metrics for Success

### User Engagement
- Insights panel interaction rate
- Badge hover rate
- Items marked as worn after suggestions
- Rotation suggestions acted upon

### Wardrobe Health
- Reduction in never-worn items
- More balanced category usage
- Increased overall wear diversity
- Higher wear counts for neglected items

### User Satisfaction
- Qualitative feedback
- Feature retention rate
- Time spent in wardrobe
- Return visit frequency

---

**Status**: Production Ready ✅  
**Version**: 2.0.0  
**Last Updated**: February 2026  
**Maintainer**: SmartStyle Team
