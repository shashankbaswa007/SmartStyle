# 🎯 LIKES BUG - ROOT CAUSE & FIX

## Problem
Likes showed "saved" toast but didn't appear on `/likes` page.

## Root Cause
The app was using temporary recommendation IDs (`temp_*`) as Firestore document IDs, causing the transaction to fail silently.

## The Fix
Modified [src/lib/likedOutfits.ts](src/lib/likedOutfits.ts#L114-L120) to generate unique `liked_*` document IDs:

```typescript
// Generate a clean document ID (don't use temp_ IDs)
const outfitDocId = `liked_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
```

## Test Now
```bash
npm run dev
```

Then: Upload photo → Like outfit → Check /likes page ✅

**Expected logs:**
```
🆔 Generated outfit document ID: liked_1768321234567_abc123
✅ Outfit saved successfully with transaction
```

✅ **FIXED** - Ready to test!
