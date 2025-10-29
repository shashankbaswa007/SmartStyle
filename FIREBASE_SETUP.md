# Firebase Configuration Files - Complete Setup Guide

## ✅ Files Created

Your SmartStyle application now has the complete Firebase integration with the following configuration files:

### 1. **`firebase.json`** - Main Firebase Configuration
- Configures Firestore, Storage, and Hosting
- Sets up Firebase Emulators for local development
- Defines deployment settings

### 2. **`.firebaserc`** - Firebase Project Configuration
- Links your local project to Firebase project: `smartstyle-c8276`
- Manages multiple Firebase environments (if needed)

### 3. **`firestore.rules`** - Firestore Security Rules ✅ (Already existed)
- Defines who can read/write to your Firestore database
- Implements user authentication and data protection

### 4. **`firestore.indexes.json`** - Firestore Database Indexes
- Optimizes queries for better performance
- Includes indexes for:
  - `recommendationHistory` (by userId and timestamp)
  - `outfitUsage` (by userId and timestamp)
  - `feedback` (by userId and createdAt)

### 5. **`storage.rules`** - Firebase Storage Security Rules
- Controls access to uploaded images
- Enforces 20MB file size limit
- Validates image file types
- Organizes storage into folders:
  - `/users/{userId}/` - User profile images
  - `/outfits/{userId}/` - Outfit photos (public read)
  - `/recommendations/{userId}/` - AI-generated images (public read)
  - `/temp/{userId}/` - Temporary uploads (auto-delete after 24h)

### 6. **`apphosting.yaml`** ✅ (Already existed)
- Firebase App Hosting configuration
- Manages deployment and scaling settings

---

## 🔧 Firebase Services Used

Your application integrates the following Firebase services:

### **1. Firebase Authentication**
- ✅ Google Sign-In
- ✅ Apple Sign-In (configured)
- User session management
- Auth state persistence

### **2. Cloud Firestore**
Collections:
- `users/{userId}` - User profiles and preferences
- `users/{userId}/recommendationHistory` - Fashion recommendations
- `users/{userId}/feedback` - User feedback on recommendations
- `users/{userId}/outfitUsage` - Usage tracking
- `userPreferences/{userId}` - Style preferences

### **3. Firebase Storage**
- Image uploads (max 20MB)
- Outfit photos
- AI-generated recommendation images
- User profile pictures

---

## 📋 Deployment Commands

### Deploy All Firebase Services:
\`\`\`bash
firebase deploy
\`\`\`

### Deploy Specific Services:
\`\`\`bash
# Deploy only Firestore rules
firebase deploy --only firestore:rules

# Deploy only Storage rules
firebase deploy --only storage

# Deploy Firestore indexes
firebase deploy --only firestore:indexes
\`\`\`

---

## 🧪 Local Development with Emulators

Start Firebase Emulators for local testing:

\`\`\`bash
firebase emulators:start
\`\`\`

**Emulator Ports:**
- 🔐 Authentication: `localhost:9099`
- 📦 Firestore: `localhost:8080`
- 🖼️ Storage: `localhost:9199`
- 🎛️ Emulator UI: `localhost:4000`

To connect your app to emulators, add this to your Firebase initialization (for development only):

\`\`\`typescript
if (process.env.NODE_ENV === 'development') {
  connectAuthEmulator(auth, 'http://localhost:9099');
  connectFirestoreEmulator(db, 'localhost', 8080);
  connectStorageEmulator(storage, 'localhost', 9199);
}
\`\`\`

---

## 🔑 Service Account (Optional for Admin SDK)

For server-side operations in production, you may need a Firebase service account:

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Select your project: `smartstyle-c8276`
3. Go to **Project Settings** → **Service Accounts**
4. Click **Generate New Private Key**
5. Save the JSON file securely (DO NOT commit to Git!)
6. Add to environment variables:

\`\`\`bash
FIREBASE_SERVICE_ACCOUNT_KEY='{"type":"service_account",...}'
\`\`\`

**Note:** Your current setup works without a service account key in development mode.

---

## 🛡️ Security Best Practices

### ✅ Already Implemented:
- Environment variables in `.env` (not committed to Git)
- Firestore security rules enforcing authentication
- Storage rules with file size and type validation
- User data isolation (users can only access their own data)

### 📝 Recommended:
- Enable App Check to prevent abuse
- Set up Firebase Security Rules testing
- Monitor Firebase usage in the console
- Set up Firebase budget alerts

---

## 📊 Monitoring & Debugging

### View Logs:
- Firebase Console → **Firestore** → **Usage** tab
- Firebase Console → **Storage** → **Usage** tab
- Firebase Console → **Authentication** → **Users** tab

### Debug Issues:
\`\`\`bash
# Check Firestore rules
firebase firestore:rules get

# Validate Firestore indexes
firebase firestore:indexes

# Check current project
firebase projects:list
\`\`\`

---

## 🚀 Next Steps

1. ✅ All Firebase config files are created
2. ✅ Environment variables are set up
3. ✅ Security rules are in place
4. 🔄 Restart your dev server (already running)
5. 🌐 Clear browser cache and test

### Optional Enhancements:
- Set up Firebase Cloud Functions for serverless operations
- Add Firebase Analytics for user tracking
- Configure Firebase Performance Monitoring
- Set up Firebase Remote Config for A/B testing

---

## 📱 Testing Checklist

- [ ] User authentication (Google Sign-In)
- [ ] Save user preferences to Firestore
- [ ] Upload outfit images to Storage
- [ ] Retrieve recommendation history
- [ ] Submit feedback on recommendations
- [ ] Track outfit usage

All Firebase services should now work seamlessly with your Next.js application! 🎉
