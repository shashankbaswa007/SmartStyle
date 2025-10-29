# Quick Test Guide 🚀

## Testing Description Length Fix

### Steps:
1. Navigate to `/style-check` page
2. Upload an outfit image
3. Fill in the form and submit
4. **Look for**: Each outfit description should have **EXACTLY 3 sentences**

### What to Check:
```
✅ CORRECT Example:
"This sophisticated ensemble combines a tailored navy blazer with crisp white 
trousers for effortless elegance. The structured silhouette is softened with a 
silk blouse in dusty rose, creating perfect balance. Perfect for business 
meetings or dinner dates, this outfit transitions seamlessly from day to evening."

❌ WRONG Example:
"Great casual look with jeans and a sweater."
(Only 1 sentence - should be rejected by validation)
```

### If Descriptions Are Still Short:
- Open browser console (F12)
- Look for Zod validation errors
- The error will say: "Description must be at least 100 characters"
- This means the AI needs to regenerate with longer descriptions

---

## Testing Likes Page Display

### Steps:
1. **Sign in** with Google (NOT anonymous)
2. Go to `/style-check` and generate recommendations
3. Click the ❤️ (heart) icon on any outfit
4. **Check browser console** - should see:
   ```
   ✅ Outfit saved successfully with ID: [some-id]
   🔗 Document path: users/[your-id]/likedOutfits/[some-id]
   ```
5. Navigate to `/likes` page
6. **Check browser console** - should see:
   ```
   ✅ Fetched outfits: X valid outfits
   ```

### Debug Panel (Development Mode Only):
Look in the **top-left corner** of the Likes page for a small black box showing:
```
User: abc12345...
Outfits: 3
Loading: No
Auth: Yes
```

### If No Outfits Appear:

#### Quick Checks:
- [ ] Are you signed in? (Not anonymous)
- [ ] Did you deploy Firestore? (`npm run deploy:firestore`)
- [ ] Check browser console for errors
- [ ] Verify Firebase Console has data

#### Console Log Pattern (Successful Save):
```
💾 Attempting to save outfit to likes...
🔍 saveLikedOutfit called with: { userId: "...", hasTitle: true, ... }
📁 Creating Firestore reference: users/[id]/likedOutfits
🔍 Checking for duplicates...
💾 Saving outfit to Firestore...
✅ Outfit saved successfully with ID: [doc-id]
```

#### Console Log Pattern (Successful Load):
```
🔍 Fetching liked outfits for user: [id]
📊 Found X liked outfits in database
✅ Successfully fetched X valid liked outfits
📊 All outfit titles: ["Title 1", "Title 2", ...]
```

#### Common Error Messages:
- **"Invalid userId: anonymous"** → Need to sign in with Google
- **"permission-denied"** → Deploy Firestore rules: `npm run deploy:firestore`
- **"Missing index"** → Deploy Firestore indexes: `npm run deploy:firestore`
- **"No liked outfits found"** → Data isn't saved yet, like an outfit first

---

## Deployment Checklist

Before testing in production, ensure:

```bash
# 1. Deploy Firestore configuration
npm run deploy:firestore

# 2. Verify in Firebase Console
# - Go to Firestore Database
# - Check "Rules" tab for likedOutfits rules
# - Check "Indexes" tab for likedOutfits index (status: Enabled)

# 3. Build and test locally
npm run build
npm run dev

# 4. Test in browser
# - Clear cache (Cmd+Shift+R)
# - Sign in with Google
# - Test saving and viewing likes
```

---

## Firebase Console Verification

### Check Data Manually:
1. Go to **Firebase Console**
2. Navigate to **Firestore Database**
3. Click **Data** tab
4. Find path: `users → [your-user-id] → likedOutfits`
5. Should see documents with fields:
   - `title`: string
   - `imageUrl`: string (URL)
   - `description`: string (3 sentences)
   - `items`: array
   - `colorPalette`: array
   - `shoppingLinks`: object
   - `likedAt`: number (timestamp)
   - `recommendationId`: string

### If No Data Exists:
- The save function isn't working
- Check browser console when clicking Like button
- Look for error messages
- Verify authentication (must not be anonymous)

---

## Emergency Debugging Commands

### Check Firebase Connection:
Open browser console and run:
```javascript
// Check auth status
console.log('Auth:', firebase.auth().currentUser);

// Check Firestore
console.log('DB:', firebase.firestore());
```

### Manual Firestore Query (in console):
```javascript
// Fetch your liked outfits manually
const userId = firebase.auth().currentUser.uid;
const db = firebase.firestore();
db.collection('users').doc(userId).collection('likedOutfits')
  .orderBy('likedAt', 'desc')
  .get()
  .then(snapshot => {
    console.log('Liked outfits:', snapshot.size);
    snapshot.forEach(doc => console.log(doc.id, doc.data()));
  });
```

### Clear All Liked Outfits (for testing):
```javascript
const userId = firebase.auth().currentUser.uid;
const db = firebase.firestore();
db.collection('users').doc(userId).collection('likedOutfits')
  .get()
  .then(snapshot => {
    snapshot.forEach(doc => doc.ref.delete());
    console.log('Cleared', snapshot.size, 'outfits');
  });
```

---

## Quick Reference: Console Logs

| Emoji | Meaning |
|-------|---------|
| 🔍 | Inspection/Debug info |
| 💾 | Saving data |
| ✅ | Success |
| ❌ | Error |
| ⚠️ | Warning |
| 📁 | File/Database operation |
| 📊 | Data summary |
| 🔗 | Reference/Link |
| ℹ️ | Information |

---

## Support Files

- **TROUBLESHOOTING_GUIDE.md** - Comprehensive debugging guide
- **FIX_SUMMARY.md** - Detailed explanation of all changes
- **Browser Console** - Primary debugging tool (F12)
- **Firebase Console** - Verify data and configuration

---

## Testing Checklist

### Description Length:
- [ ] Uploaded image and generated recommendations
- [ ] Each description has exactly 3 sentences
- [ ] No Zod validation errors in console
- [ ] Descriptions are detailed and comprehensive

### Likes Functionality:
- [ ] Signed in with Google account
- [ ] Clicked heart icon on outfit
- [ ] Saw success toast notification
- [ ] Saw save confirmation in console
- [ ] Navigated to /likes page
- [ ] Outfits are displayed correctly
- [ ] Can see all outfit details (image, title, description, items)
- [ ] Debug panel shows correct data (dev mode)

### If All Checked:
🎉 **Both features are working perfectly!**

### If Any Failed:
📖 **Check TROUBLESHOOTING_GUIDE.md** for detailed debugging steps
