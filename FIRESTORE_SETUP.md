# Firestore Setup Guide

## Error Encountered

```
Cloud Firestore API has not been used in project smartstyle-c8276 before or it is disabled.
```

## Quick Fix Steps

### Step 1: Enable Firestore API

**Option A - Direct Link:**
1. Click this link: https://console.developers.google.com/apis/api/firestore.googleapis.com/overview?project=smartstyle-c8276
2. Click **"Enable"** button
3. Wait 2-3 minutes for the API to activate

**Option B - Firebase Console (Recommended):**
1. Go to https://console.firebase.google.com/
2. Select project: **smartstyle-c8276**
3. Click **"Build"** → **"Firestore Database"** in left sidebar
4. Click **"Create Database"** button
5. Choose database mode:
   - **Test Mode**: For development (allows all reads/writes for 30 days)
   - **Production Mode**: For production (requires security rules)
6. Select location (recommend: `us-central` or closest to your users)
7. Click **"Enable"**

### Step 2: Deploy Security Rules

After Firestore is enabled:

1. In Firebase Console, go to **Firestore Database**
2. Click **"Rules"** tab
3. Copy and paste the contents from `firestore.rules` file in this project
4. Click **"Publish"**

**Or use Firebase CLI:**
```bash
# Install Firebase CLI if not already installed
npm install -g firebase-tools

# Login to Firebase
firebase login

# Initialize Firebase in your project
firebase init firestore

# Deploy rules
firebase deploy --only firestore:rules
```

### Step 3: Verify Setup

1. Restart your Next.js development server:
   ```bash
   npm run dev
   ```

2. Test the application:
   - Sign in
   - Upload an outfit
   - Check if data saves to Firestore

3. Verify in Firebase Console:
   - Go to Firestore Database
   - You should see collections being created:
     - `userPreferences`
     - `recommendationHistory`
     - `wardrobeItems`

## Security Rules Explained

The `firestore.rules` file includes:

### Collections Protected:

1. **userPreferences/{userId}**
   - Users can only read/write their own preferences
   - Stores: favorite colors, disliked colors, style preferences

2. **recommendationHistory/{recommendationId}**
   - Users can only access their own recommendation history
   - Stores: past recommendations, feedback, ratings

3. **wardrobeItems/{itemId}**
   - Users can only manage their own wardrobe items
   - Stores: uploaded clothing items

4. **users/{userId}**
   - Users can only read/write their own profile
   - Stores: user profile data

## Testing Security Rules

### Test in Firebase Console:

1. Go to Firestore Database → Rules tab
2. Click **"Rules Playground"**
3. Test scenarios:
   - Authenticated user reading own data: ✅ Should allow
   - Authenticated user reading other's data: ❌ Should deny
   - Unauthenticated user reading data: ❌ Should deny

### Test in Application:

1. Sign in as User A
2. Upload outfit → Check Firestore (should see data)
3. Sign in as User B
4. Try to access User A's data → Should fail

## Common Issues

### Issue 1: "Permission Denied" after enabling
**Solution:** Wait 2-3 minutes for API to propagate, then restart dev server

### Issue 2: "Client is offline"
**Solution:** 
- Check internet connection
- Verify Firestore is enabled
- Check Firebase config in `.env` is correct

### Issue 3: Rules deployment fails
**Solution:**
- Ensure Firebase CLI is installed: `npm install -g firebase-tools`
- Login: `firebase login`
- Initialize: `firebase init firestore`
- Deploy: `firebase deploy --only firestore:rules`

### Issue 4: Data not saving
**Solution:**
- Check browser console for errors
- Verify user is authenticated
- Check Firestore rules allow the operation
- Verify collection/document structure matches code

## Firestore Collections Structure

### userPreferences
```
/userPreferences/{userId}
  - userId: string
  - favoriteColors: string[]
  - dislikedColors: string[]
  - preferredStyles: string[]
  - avoidedStyles: string[]
  - occasionPreferences: object
  - seasonalPreferences: object
  - totalRecommendations: number
  - createdAt: timestamp
  - updatedAt: timestamp
```

### recommendationHistory
```
/recommendationHistory/{recommendationId}
  - id: string
  - userId: string
  - occasion: string
  - weather: object
  - season: string
  - recommendations: object (outfit1, outfit2, outfit3)
  - feedback: object (liked, disliked, rating, etc.)
  - imageAnalysis: object
  - createdAt: timestamp
```

### wardrobeItems
```
/wardrobeItems/{itemId}
  - userId: string
  - imageUrl: string
  - category: string
  - colors: string[]
  - formality: string
  - createdAt: timestamp
```

## Next Steps

After Firestore is enabled:

1. ✅ Restart development server
2. ✅ Sign in to application
3. ✅ Upload an outfit
4. ✅ Provide feedback
5. ✅ Check Firestore Console to see data
6. ✅ Visit /analytics to see insights
7. ✅ Deploy security rules for production

## Production Checklist

Before deploying to production:

- [ ] Enable Firestore in production project
- [ ] Deploy security rules (`firestore.rules`)
- [ ] Set up Firestore indexes (auto-created on first use)
- [ ] Test all CRUD operations
- [ ] Monitor Firestore usage in Firebase Console
- [ ] Set up backup strategy
- [ ] Configure billing alerts

## Monitoring

### In Firebase Console:

1. **Usage Tab**: Monitor reads/writes
2. **Indexes Tab**: Check auto-created indexes
3. **Rules Tab**: Verify rules are deployed
4. **Data Tab**: View collections and documents

### Cost Monitoring:

- Free tier: 50K reads, 20K writes, 20K deletes per day
- Monitor usage to avoid unexpected charges
- Set up budget alerts in Google Cloud Console

---

**Once Firestore is enabled, your personalization feature will work perfectly!**
