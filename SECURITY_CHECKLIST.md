# Security Checklist for GitHub Push

## ✅ Files That Are SAFE to Commit

- ✅ `.env.example` - Template with placeholder values
- ✅ `.env.template` - Template with placeholder values  
- ✅ `.env.local.example` - Template with placeholder values
- ✅ `firebase.json` - Public Firebase configuration
- ✅ `.firebaserc` - Public Firebase project settings
- ✅ `firestore.rules` - Security rules (no secrets)
- ✅ `firestore.indexes.json` - Database indexes (no secrets)
- ✅ `next.config.js` - Config file using environment variables
- ✅ All `.md` documentation files
- ✅ All source code files (`.ts`, `.tsx`, `.js`)
- ✅ `package.json` and `package-lock.json`

## ❌ Files That Should NEVER Be Committed

- ❌ `.env` - Contains REAL API keys
- ❌ `.env.local` - Contains REAL API keys
- ❌ `.env.development.local` - Contains REAL API keys
- ❌ `.env.production.local` - Contains REAL API keys
- ❌ Any `*service-account*.json` files - Firebase Admin credentials
- ❌ Any `*-adminsdk-*.json` files - Firebase Admin SDK keys
- ❌ Any files with "private-key" in the name

## 🔒 API Keys in This Project

### Public (Safe in Client Code)
These are prefixed with `NEXT_PUBLIC_` and are safe to expose:
- `NEXT_PUBLIC_FIREBASE_API_KEY` - Firebase client API key (restricted by Firestore rules)
- `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`
- `NEXT_PUBLIC_FIREBASE_PROJECT_ID`
- etc.

### Private (Server-Side Only - MUST BE SECRET)
These should NEVER be in client code or committed to git:
- `GROQ_API_KEY` - Groq AI API key
- `GOOGLE_GENAI_API_KEY` - Gemini API key
- `GOOGLE_GENAI_API_KEY_BACKUP` - Backup Gemini API key
- `TAVILY_API_KEY` - Tavily search API key
- `HUGGINGFACE_API_KEY` - HuggingFace API key (if used)
- `OPENWEATHER_API_KEY` - OpenWeather API key (if used)
- `FIREBASE_SERVICE_ACCOUNT_KEY` - Firebase Admin credentials (JSON)

## ✅ Pre-Push Checklist

Before pushing to GitHub, verify:

1. **Check .gitignore is properly configured:**
   ```bash
   git check-ignore .env.local .env
   ```
   Should return: `.env.local` and `.env`

2. **Verify no sensitive files are tracked:**
   ```bash
   git ls-files | grep -E '(\.env$|\.env\.local|service-account|private-key)'
   ```
   Should only return: `.env.local.example`, `.env.example`, `.env.template` (templates are safe)

3. **Check staged files don't contain secrets:**
   ```bash
   git status
   ```
   Ensure `.env.local` is NOT in the list

4. **Verify template files have placeholders:**
   ```bash
   grep "your_.*_api_key_here" .env.example
   ```
   Should show placeholder values, NOT real API keys

5. **Check no hardcoded secrets in code:**
   ```bash
   git diff --cached | grep -i "api.*key.*=.*['\"]"
   ```
   Should show NO hardcoded API keys in quotes

## 🚨 If You Accidentally Committed Secrets

If you accidentally committed API keys or secrets:

1. **Immediately rotate all exposed API keys:**
   - Groq: https://console.groq.com/keys
   - Google Gemini: https://aistudio.google.com/app/apikey
   - Firebase: https://console.firebase.google.com/
   - Tavily: https://tavily.com/dashboard

2. **Remove from git history:**
   ```bash
   # WARNING: This rewrites history!
   git filter-branch --force --index-filter \
     "git rm --cached --ignore-unmatch .env.local" \
     --prune-empty --tag-name-filter cat -- --all
   
   # Force push (use with caution!)
   git push origin --force --all
   ```

3. **Use BFG Repo-Cleaner (easier option):**
   ```bash
   # Install BFG
   brew install bfg  # macOS
   
   # Remove .env.local from history
   bfg --delete-files .env.local
   
   # Clean up
   git reflog expire --expire=now --all
   git gc --prune=now --aggressive
   
   # Force push
   git push origin --force --all
   ```

## 📋 Current Status

- ✅ `.gitignore` configured to block `.env.local` and `.env`
- ✅ `.gitignore` configured to block all service account JSON files
- ✅ Template files (`.env.example`, etc.) have placeholder values
- ✅ `.env.local` is NOT tracked by git
- ✅ All sensitive files are properly ignored

## 🔐 Environment Variable Security Best Practices

1. **Never** hardcode API keys in source code
2. **Always** use environment variables for secrets
3. **Use** `NEXT_PUBLIC_` prefix ONLY for client-safe values
4. **Keep** server-side API keys without `NEXT_PUBLIC_` prefix
5. **Test** that API keys work before committing template files
6. **Document** which keys are required in README
7. **Rotate** API keys regularly
8. **Monitor** API usage for suspicious activity

## ✅ Safe to Push Now!

All sensitive information has been secured. You can safely push to GitHub!

```bash
git add .
git commit -m "Secure all sensitive data and add comprehensive gitignore"
git push origin main
```
