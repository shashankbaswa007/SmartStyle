# 🔐 Firebase Admin Setup Guide

## Development vs Production Modes

### 🟡 Development Mode (Current State)
**Status:** ✅ **WORKING** with graceful degradation

- Recommendations **not persisted** to Firestore
- Uses **temporary IDs** (e.g., `temp_1761763516281_dl285t5sh`)
- No Firebase Admin credentials required
- Perfect for testing without database setup

**Console Output:**
```
⚠️ Firebase Admin credentials not found - skipping recommendation save (development mode)
ℹ️ To enable persistence, add FIREBASE_SERVICE_ACCOUNT_KEY to .env.local
✅ Using temporary ID (not persisted): temp_1761763516281_dl285t5sh
```

---

### 🟢 Production Mode (With Persistence)

To enable **full database persistence**, follow these steps:

#### Step 1: Generate Firebase Service Account Key

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Select your project: `smartstyle-6dcb7`
3. Click **⚙️ Settings** → **Project settings**
4. Go to **Service accounts** tab
5. Click **Generate new private key**
6. Save the JSON file securely (never commit to Git!)

#### Step 2: Add to Environment Variables

**Option A: Local Development (`.env.local`)**
```bash
# Open your .env.local file and add:
FIREBASE_SERVICE_ACCOUNT_KEY='{"type":"service_account","project_id":"smartstyle-6dcb7",...}'
```

**Option B: Production Deployment (Vercel/Firebase Hosting)**
```bash
# For Vercel:
vercel env add FIREBASE_SERVICE_ACCOUNT_KEY

# For Firebase Hosting:
# Add to apphosting.yaml under env.FIREBASE_SERVICE_ACCOUNT_KEY
```

**Option C: Using File Path (Alternative)**
```bash
# If you prefer using a file instead of inline JSON:
GOOGLE_APPLICATION_CREDENTIALS=/path/to/serviceAccountKey.json
```

#### Step 3: Restart Development Server

```bash
# Stop the server (Ctrl+C)
npm run dev
```

**Expected Console Output (Production Mode):**
```
✅ Firebase Admin SDK initialized successfully
✅ Recommendation saved to recommendationHistory: rec_1761763516281_abc123
```

---

## 🔍 How It Works

### Code Logic (`src/lib/firestoreRecommendations.ts`)

```typescript
// Check if we have Firebase credentials
const hasCredentials = 
  process.env.FIREBASE_SERVICE_ACCOUNT_KEY || 
  process.env.GOOGLE_APPLICATION_CREDENTIALS;

if (!hasCredentials) {
  // DEVELOPMENT MODE: Use temporary IDs
  console.warn('⚠️ Firebase Admin credentials not found');
  const tempId = `temp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  return tempId;
}

// PRODUCTION MODE: Use Firebase Admin SDK
const db = getFirestore();
const docRef = db
  .collection('users')
  .doc(userId)
  .collection('recommendationHistory')
  .doc(docId);

await docRef.set({
  ...payload,
  createdAt: FieldValue.serverTimestamp(),
  userId,
});
```

### Firestore Data Structure (Production)

```
users/
  └── {userId}/
      └── recommendationHistory/
          └── {recommendationId}/
              ├── occasion: "wedding"
              ├── gender: "male"
              ├── outfits: [...]
              ├── createdAt: Timestamp
              └── userId: "abc123"
```

---

## 🛡️ Security Best Practices

### ✅ DO:
- ✅ Use environment variables for credentials
- ✅ Add `.env.local` to `.gitignore`
- ✅ Store service account key securely
- ✅ Use Firebase Admin SDK for server-side operations
- ✅ Validate user authentication before writes

### ❌ DON'T:
- ❌ Commit service account keys to Git
- ❌ Share credentials in public repositories
- ❌ Use client SDK for server-side writes
- ❌ Allow unauthenticated writes to production database

---

## 🧪 Testing Persistence

### Test in Development Mode (No Credentials)
```bash
npm run dev
# Upload image → Get recommendations
# Check console:
✅ Using temporary ID (not persisted): temp_...
```

### Test in Production Mode (With Credentials)
```bash
# Add FIREBASE_SERVICE_ACCOUNT_KEY to .env.local
npm run dev
# Upload image → Get recommendations
# Check console:
✅ Recommendation saved to recommendationHistory: rec_...
```

### Verify in Firestore Console
1. Go to [Firestore Console](https://console.firebase.google.com/)
2. Navigate to **Firestore Database**
3. Check path: `users/{userId}/recommendationHistory/{recId}`
4. Verify data exists with correct structure

---

## 🔧 Troubleshooting

### Issue: "Could not load default credentials"
**Cause:** Missing `FIREBASE_SERVICE_ACCOUNT_KEY` or `GOOGLE_APPLICATION_CREDENTIALS`

**Solution:**
```bash
# Add to .env.local:
FIREBASE_SERVICE_ACCOUNT_KEY='{"type":"service_account",...}'
```

### Issue: "Permission denied" after adding credentials
**Cause:** Firestore rules blocking write access

**Solution:**
```bash
# Deploy updated Firestore rules:
firebase deploy --only firestore:rules
```

### Issue: Credentials in environment but still using temp IDs
**Cause:** Environment variables not loaded

**Solution:**
```bash
# Restart dev server:
npm run dev

# Check if loaded:
console.log(process.env.FIREBASE_SERVICE_ACCOUNT_KEY?.substring(0, 20));
```

---

## 📊 Feature Comparison

| Feature | Development Mode | Production Mode |
|---------|-----------------|-----------------|
| Recommendations | ✅ Working | ✅ Working |
| Image Generation | ✅ Working | ✅ Working |
| Gemini Analysis | ✅ Working | ✅ Working |
| Tavily Shopping | ✅ Working | ✅ Working |
| Like Button | ✅ Working | ✅ Working |
| **Firestore Persistence** | ❌ Temporary IDs | ✅ Full Persistence |
| **Recommendation History** | ❌ Not saved | ✅ Saved to DB |
| **Analytics** | ❌ Not tracked | ✅ Tracked |
| **User Profiles** | ❌ Not saved | ✅ Saved |

---

## 🎯 Next Steps

### For Development:
- ✅ **Current state is perfect for testing**
- Continue developing features without database setup
- All AI features work correctly

### For Production:
1. Generate Firebase service account key
2. Add `FIREBASE_SERVICE_ACCOUNT_KEY` to environment
3. Deploy Firestore rules
4. Test persistence in production environment
5. Monitor Firestore usage and quotas

---

**Current Status:** 🟡 **Development Mode Active**  
**Production Ready:** ✅ **Yes** (add credentials when needed)
