# Firebase Quick Reference - SmartStyle

## 📁 Firebase Configuration Files Status

| File | Status | Purpose |
|------|--------|---------|
| ✅ `firebase.json` | Created | Main Firebase configuration |
| ✅ `.firebaserc` | Created | Project linking (smartstyle-c8276) |
| ✅ `firestore.rules` | Existing | Database security rules |
| ✅ `firestore.indexes.json` | Created | Database query optimization |
| ✅ `storage.rules` | Created | Storage security rules |
| ✅ `apphosting.yaml` | Existing | App hosting config |
| ✅ `.env` | Fixed | Environment variables (no quotes) |
| ✅ `.env.local` | Existing | Local environment overrides |

## 🔐 Environment Variables (All Present)

```bash
NEXT_PUBLIC_FIREBASE_API_KEY=your_firebase_api_key_here
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your-project-id.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your-project-id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your-project-id.firebasestorage.app
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
NEXT_PUBLIC_FIREBASE_APP_ID=your_app_id
```

## 🚀 Common Firebase Commands

### Deploy All Services
```bash
firebase deploy
```

### Deploy Individual Services
```bash
firebase deploy --only firestore:rules
firebase deploy --only firestore:indexes
firebase deploy --only storage
```

### Local Development (Emulators)
```bash
firebase emulators:start
```

### Check Current Project
```bash
firebase projects:list
firebase use
```

### Test Security Rules
```bash
firebase emulators:start --only firestore,auth
```

## 📊 Firebase Services Integration

### Client-Side (`src/lib/firebase.ts`)
- ✅ Firebase App initialization
- ✅ Authentication service
- ✅ Firestore database
- ✅ Storage service

### Server-Side (`src/lib/firebase-admin.ts`)
- ✅ Firebase Admin SDK
- ✅ Server-side Firestore access
- ✅ User verification

## 🔧 Troubleshooting

### Issue: "Missing Firebase configuration"
**Solution:** 
1. Clear browser cache (Cmd+Shift+R)
2. Clear Next.js cache: `rm -rf .next`
3. Restart dev server: `npm run dev`

### Issue: "Permission denied" in Firestore
**Solution:**
1. Check `firestore.rules`
2. Ensure user is authenticated
3. Deploy rules: `firebase deploy --only firestore:rules`

### Issue: "Storage upload failed"
**Solution:**
1. Check file size (<20MB)
2. Verify file is an image
3. Ensure user is authenticated
4. Deploy rules: `firebase deploy --only storage`

## 📱 Firebase Console Links

- **Project Dashboard**: https://console.firebase.google.com/project/smartstyle-c8276
- **Authentication**: https://console.firebase.google.com/project/smartstyle-c8276/authentication
- **Firestore**: https://console.firebase.google.com/project/smartstyle-c8276/firestore
- **Storage**: https://console.firebase.google.com/project/smartstyle-c8276/storage

## ✅ Setup Complete!

All Firebase configuration files are now in place and your application is fully integrated with Firebase services. The dev server is running with the correct environment variables.

**Next Steps:**
1. Clear your browser cache (Cmd+Shift+R or open incognito)
2. Test authentication features
3. Verify Firestore read/write operations
4. Test image uploads to Storage

For detailed information, see `FIREBASE_SETUP.md`
