# Troubleshooting Guide

## Issue 1: AI-Generated Descriptions Are Too Short

### Problem
The outfit descriptions in recommendations are only one sentence instead of the required three sentences.

### Solution Applied
1. **Schema Validation Enhanced**: Added `.min(100, 'Description must be at least 100 characters')` to the Zod schema to enforce minimum length.

2. **Prompt Instructions Strengthened**: Updated the prompt with explicit requirements:
   ```
   MANDATORY - EXACTLY 3 COMPLETE SENTENCES (minimum 100 characters)
   - Sentence 1: Describe the overall look and key pieces
   - Sentence 2: Explain styling details and how pieces work together  
   - Sentence 3: Highlight versatility, occasions, or why it's perfect for the user
   ```

3. **Examples Added**: Included both correct and incorrect examples in the prompt to guide the AI:
   - ❌ WRONG: "Great casual look with jeans and a sweater." (Only 1 sentence)
   - ✅ CORRECT: "This casual weekend look pairs dark wash jeans with a cozy cream knit sweater. The relaxed fit is elevated with structured accessories and ankle boots in cognac brown. Perfect for brunch, shopping, or casual Friday at the office."

### Testing
After these changes, test by:
1. Go to the Style Check page
2. Upload an image and get recommendations
3. Verify each outfit description has exactly 3 sentences
4. If still seeing short descriptions, check the browser console for any Zod validation errors

---

## Issue 2: Liked Recommendations Not Displaying on Likes Page

### Problem
When users like outfits, they appear to save successfully (toast notifications show), but the Likes page shows no outfits.

### Possible Causes & Solutions

#### Cause 1: Firestore Index Not Deployed
**Symptom**: Console shows Firestore error about missing index

**Solution**:
```bash
# Deploy Firestore indexes
firebase deploy --only firestore:indexes

# Or use the npm script
npm run deploy:firestore
```

**Verification**: Check Firebase Console → Firestore → Indexes tab to confirm the `likedOutfits` index is active.

#### Cause 2: Firestore Rules Not Deployed
**Symptom**: Console shows "permission-denied" errors

**Solution**:
```bash
# Deploy Firestore rules
firebase deploy --only firestore:rules
```

**Verification**: Go to Firebase Console → Firestore → Rules tab to confirm rules are deployed.

#### Cause 3: Authentication Issue
**Symptom**: User ID is null or "anonymous"

**Solution**:
1. Sign out and sign in again
2. Check browser console for authentication errors
3. Verify Firebase Auth is properly configured in Firebase Console

**Debugging**:
- Open browser console on the Likes page
- Look for logs showing: `🔍 Fetching liked outfits for user: [userId]`
- If userId is missing or "anonymous", there's an auth issue

#### Cause 4: Data Not Actually Being Saved
**Symptom**: No data in Firestore database

**Solution**:
1. Go to Firebase Console → Firestore Database
2. Navigate to: `users → [your-user-id] → likedOutfits`
3. Check if documents exist

If no documents exist:
- Check browser console when clicking the Like button
- Look for error messages in the `saveLikedOutfit` function
- Verify the outfit data is valid (has title and imageUrl)

#### Cause 5: Client-Side Caching Issue
**Solution**:
```bash
# Clear browser cache and hard reload
# Chrome: Cmd+Shift+R (Mac) or Ctrl+Shift+R (Windows)
# Or clear all browser data for the site
```

### Debugging Steps

1. **Check Browser Console on Likes Page**:
   - Look for: `✅ Fetched outfits: X valid outfits`
   - If X = 0, check Firestore database directly
   - Look for any error messages

2. **Check Browser Console When Liking an Outfit**:
   - Look for: `✅ Outfit saved successfully with ID: [doc-id]`
   - Look for: `🔗 Document path: users/[userId]/likedOutfits/[doc-id]`
   - If you see errors, read the error message carefully

3. **Check Firebase Console**:
   - Go to Firestore Database
   - Navigate to `users` collection
   - Find your user ID (check console logs for the exact ID)
   - Look inside the `likedOutfits` subcollection
   - Verify documents exist with proper data

4. **Verify Data Structure**:
   Each liked outfit document should have:
   ```json
   {
     "imageUrl": "https://...",
     "title": "Outfit name",
     "description": "Three sentence description...",
     "items": ["item1", "item2", ...],
     "colorPalette": ["#RRGGBB", "#RRGGBB", ...],
     "shoppingLinks": {
       "amazon": null,
       "ajio": null,
       "myntra": null
     },
     "likedAt": 1234567890,
     "recommendationId": "rec-id"
   }
   ```

5. **Development Debug Panel**:
   - In development mode, a debug panel appears in the top-left of the Likes page
   - Shows: User ID, outfit count, loading state, auth state
   - Use this to quickly verify authentication and data loading

### Quick Fix Checklist

- [ ] Signed in with Google account (not anonymous)
- [ ] Firestore indexes deployed (`npm run deploy:firestore`)
- [ ] Firestore rules deployed (`firebase deploy --only firestore:rules`)
- [ ] Browser console shows successful save logs
- [ ] Firebase Console shows documents in `users/[userId]/likedOutfits`
- [ ] Browser cache cleared and page hard-reloaded
- [ ] No errors in browser console on Likes page

### Still Not Working?

If you've checked all the above and it still doesn't work:

1. **Check Network Tab**:
   - Open browser DevTools → Network tab
   - Filter by "firestore" 
   - Look for failed requests (red)
   - Check the response for error messages

2. **Check Firebase Status**:
   - Visit https://status.firebase.google.com/
   - Verify Firestore is operational

3. **Test with Firebase Emulator** (for development):
   ```bash
   # Install Firebase tools
   npm install -g firebase-tools
   
   # Initialize emulators
   firebase init emulators
   
   # Start emulators
   firebase emulators:start
   ```

4. **Re-deploy Everything**:
   ```bash
   npm run deploy
   ```

### Console Log Reference

**When Saving a Like** (successful):
```
💾 Attempting to save outfit to likes...
🔍 saveLikedOutfit called with: { userId: "...", hasTitle: true, ... }
📁 Creating Firestore reference: users/[userId]/likedOutfits
🔍 Checking for duplicates...
💾 Saving outfit to Firestore...
✅ Outfit saved successfully with ID: [doc-id]
🔗 Document path: users/[userId]/likedOutfits/[doc-id]
✅ Outfit selection tracked successfully!
```

**When Loading Likes Page** (successful):
```
🔍 Fetching liked outfits for user: [userId]
📊 Found X liked outfits in database
✅ Successfully fetched X valid liked outfits
```

**Error Patterns to Look For**:
- `❌ Invalid userId:` - Authentication problem
- `❌ Permission denied` - Firestore rules not deployed
- `❌ Missing index` - Firestore indexes not deployed  
- `❌ Invalid outfit data` - Data validation failed
- `❌ Error fetching liked outfits` - Database read failed

---

## General Tips

1. **Always Check Browser Console First**: Most issues will show clear error messages in the console.

2. **Verify Firebase Configuration**: Ensure all `NEXT_PUBLIC_FIREBASE_*` environment variables are set in `.env.local`.

3. **Development vs Production**: Some features require deployment to work correctly. Test in production after deployment.

4. **Clear Cache Frequently**: When testing Firebase changes, clear your browser cache to avoid stale data.

5. **Check Firebase Quotas**: If you've hit your free tier limits, some operations may fail. Check Firebase Console → Usage tab.

---

## Contact & Support

If you're still experiencing issues after following this guide, please:

1. Check the browser console and copy any error messages
2. Check the Firebase Console for any quota or billing issues
3. Verify all environment variables are correctly set
4. Try the application in incognito mode to rule out extension interference
