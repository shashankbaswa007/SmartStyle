# Environment Setup Guide

## Quick Start

1. **Clone the repository:**
   ```bash
   git clone <your-repo-url>
   cd SmartStyle
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Set up environment variables:**
   ```bash
   cp .env.local.example .env.local
   ```

4. **Add your API keys to `.env.local`:**
   
   Open `.env.local` and replace all placeholder values with your actual API keys.

## Required API Keys

### 🔑 Groq API (AI Chat & Analysis)
- **Get your key:** https://console.groq.com/keys
- **Environment variable:** `GROQ_API_KEY`
- **Usage:** Main AI analysis for outfit recommendations

### 🔑 Google Gemini API (Image Analysis & Query Optimization)
- **Get your key:** https://aistudio.google.com/app/apikey
- **Environment variables:** 
  - `GOOGLE_GENAI_API_KEY` (primary)
  - `GOOGLE_GENAI_API_KEY_BACKUP` (optional backup)
- **Usage:** Image analysis and e-commerce query optimization

### 🔑 Tavily API (Web Search)
- **Get your key:** https://tavily.com/dashboard
- **Environment variable:** `TAVILY_API_KEY`
- **Usage:** E-commerce product search (TATA CLiQ, Amazon, Myntra)

### 🔑 Firebase (Database & Authentication)
- **Setup:** https://console.firebase.google.com/
- **Required:** Create a new Firebase project with Firestore and Authentication enabled
- **Environment variables:**
  ```
  NEXT_PUBLIC_FIREBASE_API_KEY=
  NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=
  NEXT_PUBLIC_FIREBASE_PROJECT_ID=
  NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=
  NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=
  NEXT_PUBLIC_FIREBASE_APP_ID=
  ```

### 🔑 Firebase Admin SDK (Server-Side Operations)
- **Setup:** Firebase Console → Project Settings → Service Accounts → Generate New Private Key
- **Save the JSON file** in your project root (it will be ignored by git)
- **Environment variable:** `FIREBASE_SERVICE_ACCOUNT_KEY` (path to the JSON file)

### 🔑 Optional APIs
- **HuggingFace:** https://huggingface.co/settings/tokens (if using additional AI models)
- **OpenWeather:** https://openweathermap.org/api (if using weather features)

## Environment File Structure

### `.env.local` (Your actual secrets - NOT committed to git)
```bash
# Groq AI
GROQ_API_KEY=gsk_your_actual_key_here

# Google Gemini
GOOGLE_GENAI_API_KEY=AIzaSy_your_actual_key_here
GOOGLE_GENAI_API_KEY_BACKUP=AIzaSy_your_backup_key_here

# Tavily Search
TAVILY_API_KEY=tvly-your_actual_key_here

# Firebase Client (Public)
NEXT_PUBLIC_FIREBASE_API_KEY=AIzaSy_your_firebase_key_here
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your-project-id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your-project.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=123456789
NEXT_PUBLIC_FIREBASE_APP_ID=1:123456789:web:abcdef

# Firebase Admin (Server-Side)
FIREBASE_SERVICE_ACCOUNT_KEY=./your-project-firebase-adminsdk.json

# Optional
HUGGINGFACE_API_KEY=hf_your_key_here
OPENWEATHER_API_KEY=your_key_here
```

### `.env.local.example` (Template - safe to commit)
```bash
# This is a template file with placeholder values
# Copy this to .env.local and add your actual API keys

GROQ_API_KEY=your_groq_api_key_here
GOOGLE_GENAI_API_KEY=your_google_genai_api_key_here
# ... etc
```

## Firebase Setup Instructions

### 1. Create Firebase Project
1. Go to https://console.firebase.google.com/
2. Click "Add project"
3. Enter project name: `smartstyle-app` (or your choice)
4. Enable Google Analytics (optional)
5. Click "Create project"

### 2. Enable Firestore Database
1. In Firebase Console, click "Firestore Database"
2. Click "Create database"
3. Choose "Start in production mode"
4. Select a location (choose closest to your users)
5. Click "Enable"

### 3. Enable Authentication
1. In Firebase Console, click "Authentication"
2. Click "Get started"
3. Enable "Google" sign-in provider
4. Add your domain to authorized domains

### 4. Get Client Configuration
1. Click Project Settings (gear icon)
2. Scroll to "Your apps" section
3. Click "Web" (</>) icon
4. Register your app
5. Copy the config values to your `.env.local`:
   ```
   NEXT_PUBLIC_FIREBASE_API_KEY=...
   NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=...
   etc.
   ```

### 5. Generate Admin SDK Key
1. Project Settings → Service Accounts
2. Click "Generate new private key"
3. Save the JSON file as `firebase-admin-key.json` in your project root
4. In `.env.local`, set:
   ```
   FIREBASE_SERVICE_ACCOUNT_KEY=./firebase-admin-key.json
   ```

### 6. Deploy Firestore Rules
```bash
firebase deploy --only firestore:rules
```

## Verification

After setting up your `.env.local`, verify everything works:

```bash
# Run development server
npm run dev

# Open browser
open http://localhost:3000

# Test authentication
# - Click "Sign In" button
# - Sign in with Google
# - Should redirect to home page

# Test style analysis
# - Upload an image
# - Should receive AI-powered outfit recommendations
```

## Troubleshooting

### "Firebase Admin error: Could not load the default credentials"
- Ensure `FIREBASE_SERVICE_ACCOUNT_KEY` path is correct
- Verify the JSON file exists and has valid content
- Check file permissions: `chmod 600 firebase-admin-key.json`

### "Groq API error: Invalid API key"
- Verify your Groq API key at https://console.groq.com/keys
- Check for extra spaces in `.env.local`
- Restart the dev server: `npm run dev`

### "Tavily search not returning results"
- Check Tavily API quota: https://tavily.com/dashboard
- Verify API key is active
- Check network connectivity

### "Firebase Authentication not working"
- Ensure your domain is in authorized domains list
- Check Firebase Authentication is enabled
- Verify `NEXT_PUBLIC_FIREBASE_*` variables are correct

## Security Notes

⚠️ **NEVER commit your `.env.local` file to git!**

✅ The `.gitignore` is configured to prevent this, but always double-check:
```bash
git status
```

If you see `.env.local` in the output, it means `.gitignore` is not working correctly.

✅ All template files (`.env.example`, `.env.template`, `.env.local.example`) contain only placeholder values and are safe to commit.

✅ Service account JSON files are automatically ignored by `.gitignore`.

## Need Help?

- **Firebase Issues:** https://firebase.google.com/support
- **Groq API Issues:** https://console.groq.com/docs
- **Tavily Issues:** https://docs.tavily.com/
- **Project Issues:** [Open an issue on GitHub]

## License

[Your License Here]
