# 🔒 Pre-Push Security Checklist

Run this checklist **BEFORE every git push** to ensure no sensitive data leaks.

## ✅ Automated Checks

```bash
# 1. Verify .env files are properly ignored
git check-ignore .env .env.local
# Expected: Both should be listed

# 2. Check that .env.example is NOT ignored
git ls-files | grep .env.example
# Expected: .env.example should appear

# 3. Search for accidental API keys in staged files
git diff --cached | grep -iE '(AIzaSy|gsk_|tvly-|hf_[A-Za-z0-9]{20}|private[_-]?key|secret[_-]?key)'
# Expected: No matches (exit code 1)

# 4. Check for service account files
git status | grep -iE '(service.*account|adminsdk|credentials)\.json'
# Expected: No matches (exit code 1)

# 5. Verify what files will be pushed
git status
git diff --cached --name-only
```

## ✅ Manual Verification

### Environment Files
- [ ] `.env` and `.env.local` are in `.gitignore`
- [ ] `.env.example` exists with placeholder values only
- [ ] No real API keys in `.env.example`

### Documentation
- [ ] No real API keys in `*.md` files
- [ ] SECURITY.md uses placeholder examples
- [ ] README.md doesn't contain secrets

### Source Code
- [ ] No hardcoded API keys in `src/**/*.{ts,tsx,js,jsx}`
- [ ] `next.config.js` uses `process.env.*`, not hardcoded values
- [ ] Firebase config files (`firebase.json`, `.firebaserc`) contain no secrets

### Firebase
- [ ] No `*service-account*.json` files in repository
- [ ] `firestore.rules` and `storage.rules` are safe to commit
- [ ] Firebase Admin SDK uses env variables, not hardcoded credentials

## 🔍 Files Safe to Commit

✅ **Configuration (no secrets):**
- `.env.example` (template only)
- `next.config.js` (uses env vars)
- `firebase.json`, `.firebaserc`
- `firestore.rules`, `firestore.indexes.json`
- `storage.rules`
- `package.json`, `tsconfig.json`
- `.gitignore`, `.eslintrc.json`

✅ **Documentation:**
- All `*.md` files (after sanitization)
- `docs/**/*.md`

✅ **Source code:**
- All files in `src/`, `app/`, `components/`
- All TypeScript/JavaScript files

## ❌ Files to NEVER Commit

❌ **Secrets:**
- `.env`, `.env.local`, `.env.*.local`
- `*service-account*.json`
- `*-adminsdk-*.json`
- Any file with `private-key` or `secret-key`

❌ **Build/Cache:**
- `.next/`, `node_modules/`
- `.genkit/`, `.firebase/`
- `*.tsbuildinfo`

❌ **Personal:**
- `.DS_Store`, `.vscode/`, `.idea/`

## 🚨 If You Accidentally Committed Secrets

### Immediate Actions:

1. **DO NOT PUSH** to remote repository
2. **Rotate all exposed keys immediately:**
   - Firebase: Console → Project Settings → Generate new keys
   - Google AI: https://aistudio.google.com/app/apikey
   - Groq: https://console.groq.com/keys
   - Tavily: https://tavily.com/dashboard

3. **Remove from git history:**
```bash
# Soft reset if not yet pushed
git reset --soft HEAD~1

# Or amend last commit
git commit --amend

# If already pushed (dangerous - coordinate with team!)
# Use git-filter-branch or BFG Repo Cleaner
```

4. **Update security rules and enable monitoring**

### If Already Pushed to Public Repo:

1. **IMMEDIATELY ROTATE ALL KEYS** (highest priority)
2. Contact GitHub Support to purge from cache
3. Consider the keys compromised permanently
4. Review Firebase/API usage logs for abuse
5. Enable rate limiting and alerts
6. Update all deployment environments

## 🎯 Quick Commands

```bash
# Run all checks at once
echo "=== Checking .gitignore ===" && \
git check-ignore .env .env.local && \
echo "=== Searching for secrets ===" && \
! git diff --cached | grep -iE '(AIzaSy|gsk_|tvly-|hf_[A-Za-z0-9]{20})' && \
echo "=== Listing staged files ===" && \
git diff --cached --name-only && \
echo "✅ All checks passed! Safe to push."
```

## 📊 Security Score

Check your score before pushing:

- [ ] All `.env*` files properly ignored (20 pts)
- [ ] `.env.example` exists with placeholders (20 pts)
- [ ] No secrets in source code (20 pts)
- [ ] No secrets in documentation (20 pts)
- [ ] No service account JSON files (20 pts)

**Total: ___/100** (Must be 100 to push safely!)

## 🔗 Resources

- [GitHub Secret Scanning](https://docs.github.com/en/code-security/secret-scanning)
- [Firebase Security Rules](https://firebase.google.com/docs/rules)
- [Next.js Environment Variables](https://nextjs.org/docs/basic-features/environment-variables)
- [Git Secrets Tool](https://github.com/awslabs/git-secrets)

---

**Remember:** When in doubt, DON'T PUSH. Review and sanitize first!
