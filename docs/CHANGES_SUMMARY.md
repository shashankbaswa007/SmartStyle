# Quick Reference - Recent Changes Summary

## 🎯 What Changed

### 1. Smart Query Generation (AI-Powered)
**File:** `src/ai/flows/generate-shopping-query.ts`

Now uses Gemini 2.0 Flash to generate optimized e-commerce search queries:
- Platform-specific optimization (simple queries for TATA CLiQ)
- Fallback query generation
- Keyword extraction for result filtering
- Exclude terms to prevent irrelevant results

### 2. Fixed TATA CLiQ URLs
**Files:** `src/lib/tavily.ts`, `src/components/style-advisor-results.tsx`

**OLD (broken):**
```
https://www.tatacliq.com/search/?searchCategory=men&text=query
```

**NEW (working):**
```
https://www.tatacliq.com/search?q=query:relevance:inStockFlag:true
```

### 3. Individual Item Shopping Links Persistence
**Files:** 
- `src/lib/likedOutfits.ts` - Added `itemShoppingLinks` field
- `src/components/style-advisor-results.tsx` - Generate and save links when outfit is liked

**Before:** Individual item links regenerated on every page load (could change with context)

**After:** Links saved once when outfit is liked, remain consistent forever

```typescript
// Data structure saved to Firebase
{
  itemShoppingLinks: [
    {
      item: "Blue Blazer",
      amazon: "https://...",
      tatacliq: "https://...",
      myntra: "https://..."
    },
    // ... more items
  ]
}
```

---

## 🔄 How It Works

### Recommendation Flow (New)
```
1. User uploads image
2. AI generates outfit recommendations
3. For each outfit:
   a. Gemini generates smart search query
   b. Tavily searches Amazon + Myntra
   c. Special handling for TATA CLiQ:
      - Try AI-optimized simple query
      - Fallback to progressively simpler queries
      - Final fallback: direct search URL
4. Results displayed with shopping links
```

### Like Flow (Enhanced)
```
1. User clicks "Like" ❤️
2. System generates individual item shopping links
3. Saves to Firebase:
   - Outfit details
   - Outfit-level shopping links
   - Individual item shopping links (NEW!)
4. Toast notification confirms save
```

### Likes Page Display (Fixed)
```
1. Fetch liked outfits from Firebase
2. For each outfit:
   a. Display outfit image & details
   b. Show outfit-level shopping links
   c. Show individual item links:
      - Use saved links if available ✓
      - Otherwise generate fresh links (backward compatibility)
```

---

## 🛠️ Technical Details

### Multi-Tier Fallback Strategy
```
Level 1: AI-optimized query → Tavily API
         ↓ (if fails)
Level 2: Simplified queries → Tavily API
         ↓ (if fails)
Level 3: Direct search URLs (always works)
```

### TATA CLiQ Special Handling
```typescript
// Why special handling?
// - TATA CLiQ requires very simple queries (2-4 words)
// - Complex queries return "no results"

// Strategy:
1. Ask Gemini for tataCliqQuery (separate, simple)
2. Don't filter results by keywords (lenient)
3. Progressive simplification if still fails:
   - "men formal blazer" → "men blazer" → "blazer"
```

### Type Safety
```typescript
// Extended outfit type for liked outfits
type OutfitWithLinks = AIOutfit & {
  itemShoppingLinks?: Array<{
    item: string;
    amazon: string;
    tatacliq: string;
    myntra: string;
  }>;
};

// Smart link resolution
if (outfit.itemShoppingLinks) {
  // Use saved links (consistent)
} else {
  // Generate fresh (for new recommendations)
}
```

---

## 📋 Environment Variables Required

```bash
# Critical
NEXT_PUBLIC_FIREBASE_API_KEY=your_key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your_domain
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your_project
GOOGLE_GENAI_API_KEY=your_gemini_key

# Optional (has fallbacks)
TAVILY_API_KEY=your_tavily_key
```

---

## 🐛 Debugging Tips

### If TATA CLiQ links show "no results":
```
1. Check console for Tavily logs:
   🔍 Search query used
   ✅ Number of results found
   
2. Verify URL format includes:
   :relevance:inStockFlag:true
   
3. Try simplifying the query manually
```

### If individual item links not persisting:
```
1. Check Firebase console:
   - Navigate to users/{userId}/likedOutfits
   - Verify itemShoppingLinks array exists
   
2. Check browser console:
   📦 Data to save: ... (should show itemShoppingLinks)
   
3. Verify user is signed in (not anonymous)
```

### If TypeScript errors appear:
```
1. Run: npm run typecheck
2. Check OutfitWithLinks type is imported
3. Verify outfit variable uses outfitWithLinks cast
```

---

## 🚀 Testing Checklist

### Basic Functionality
- [ ] Generate new recommendations
- [ ] Like an outfit
- [ ] Check Likes page
- [ ] Click individual item links
- [ ] Verify TATA CLiQ links work

### Edge Cases
- [ ] Like same outfit twice (duplicate detection)
- [ ] Sign out and try to like (auth check)
- [ ] Disable TAVILY_API_KEY (fallback test)
- [ ] Test with very long color names
- [ ] Test with missing outfit.items

### Cross-Browser
- [ ] Chrome
- [ ] Safari
- [ ] Firefox
- [ ] Mobile Safari
- [ ] Mobile Chrome

---

## 📞 Support

If issues arise:

1. **Check Logs:** Browser console + Firebase Functions logs
2. **Verify Environment:** All required env vars set?
3. **Test Isolation:** Does it work with fresh recommendations?
4. **Review This Guide:** Common issues covered above
5. **Check CHECKOUT_REPORT.md:** Comprehensive troubleshooting

---

**Last Updated:** October 30, 2025  
**Version:** 1.0
