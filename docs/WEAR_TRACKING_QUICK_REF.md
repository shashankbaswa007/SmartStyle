# Enhanced Wear Tracking System - Quick Reference

## 🎯 Smart Insights (7 Types)

| Insight | When It Shows | Purpose | Color |
|---------|--------------|---------|-------|
| **Overused Items** 🔥 | Worn >2× avg AND ≥8 times | Suggest similar items | Amber |
| **Rotation Suggestions** 🔄 | Worn 1-2× but not in past month | Refresh style | Purple |
| **Category Imbalance** ℹ️ | Type has ≥2 items, avg <1 wear | Balance wardrobe | Teal |
| **Seasonal Opportunities** ☀️ | ≥2 seasonal items not worn recently | Timely reminders | Teal |
| **Forgotten Items** ⏰ | Never worn, added >1 month | Get them worn | Amber |
| **Wardrobe MVP** ❤️ | Worn ≥5 times | Celebrate favorites | Rose |
| **Past Favorites** 💜 | Worn ≥2×, not in 3+ months | Rediscover items | Purple |

## 🏷️ Item Badges (8 Types)

| Badge | Condition | Meaning | Color |
|-------|-----------|---------|-------|
| **Nx 🔥** | Worn >2× avg, ≥8 total | Heavy rotation | Blue |
| **Nx ❤️** | Worn 5-7 times | Favorite | Rose |
| **New ✨** | Never worn, added <7 days | Recent addition | Teal |
| **Try me! 👀** | Never worn, added >30 days | Needs attention | Amber |
| **Unworn 📦** | Never worn, added 7-30 days | Awaiting debut | Gray |
| **Rotate in? 🔄** | Worn 1-2×, not in 1+ month | Good candidate | Purple |
| **Miss me? 💜** | Worn ≥3×, not in 3+ months | Long neglected | Purple |
| **Recent ✓** | Worn in past 2 weeks | Currently active | Emerald |

## 💬 Hover Tooltips

All badges show detailed info on hover:
- Total wear count
- Last worn (relative time)
- Added date (if recent)

**Examples:**
- "Worn 5 times • worn 2 days ago"
- "Never worn • added 3 weeks ago"
- "Worn 8 times • worn yesterday"

## 📊 Analysis Logic

### Average Wear Count
```
avgWearCount = totalWears / itemsWithWears
```
Used to identify items worn significantly more/less than typical

### Time Thresholds
- **Recent**: <2 weeks
- **Not Recent**: 2-4 weeks
- **Neglected**: 1-3 months
- **Long-term Neglected**: >3 months

### Priority Order
1. Context-specific insights (if applicable)
2. Overused items
3. Rotation suggestions
4. Category imbalances
5. Seasonal opportunities
6. Forgotten items
7. Wardrobe MVP
8. Past favorites

Max 4 insights shown at once

## 🎨 Color Meanings

| Color | Usage | Emotion |
|-------|-------|---------|
| **Amber** | Attention needed | Warning (gentle) |
| **Purple** | Rotation/rediscovery | Inspiration |
| **Teal** | Information/new | Positive |
| **Rose** | Favorites | Love/appreciation |
| **Blue** | High usage | Cool/reliable |
| **Emerald** | Recent activity | Fresh/active |
| **Gray** | Neutral status | Informational |

## 🔄 Update Triggers

Insights recalculate when:
- Wardrobe items change (real-time sync)
- Item marked as worn
- Context mode changed
- Page loads/refreshes

## 📱 User Interactions

### Insights Panel
- Click header to expand/collapse
- Shows badge count: "Smart Insights [4]"
- Animations on expand/collapse
- Auto-adapts to context mode

### Item Badges
- Hover to see detailed tooltip
- Cursor changes to help (?)
- No click action (info only)
- Visible in all views (grid, color-grouped)

## ✅ Best Practices

### For Users
1. Mark items as worn regularly for accurate insights
2. Review insights weekly to plan outfits
3. Act on rotation suggestions to maximize wardrobe
4. Use seasonal reminders to time outfits
5. Hover badges for detailed wear history

### For Developers
1. No new state needed (uses existing data)
2. All calculations client-side (fast)
3. Prioritize insights (show most actionable first)
4. Keep max 4 insights (prevent overwhelm)
5. Use relative time (more human-friendly)

## 🧪 Testing Checklist

- [ ] Empty wardrobe (no insights)
- [ ] 1-5 items (basic insights)
- [ ] 10+ items (full variety)
- [ ] All items same wear count (no favorites)
- [ ] Some items never worn (forgotten insight)
- [ ] Seasonal items (seasonal opportunity)
- [ ] Context mode change (adapted insights)
- [ ] Badge hover (tooltip appears)
- [ ] Mark as worn (insights update)
- [ ] Large wardrobe 50+ items (performance)

## 🚀 Key Benefits

### For Users
✅ Know what to wear today (avoid repeats)  
✅ Discover forgotten items (maximize wardrobe)  
✅ Balance wear patterns (avoid overuse)  
✅ Get timely seasonal reminders  
✅ Celebrate favorite items  
✅ Make informed shopping decisions  

### For App
✅ Zero breaking changes  
✅ No schema modifications  
✅ Backward compatible  
✅ Performance optimized  
✅ Privacy preserved (client-side)  
✅ Accessible design  

---

**Quick Start**: The system works automatically with existing data. No setup required. Just mark items as worn and watch the insights appear!

**Pro Tip**: Expand the insights panel weekly to get fresh recommendations and maximize your wardrobe potential.
