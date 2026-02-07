# 🔐 Security Checklist for Production Deployment

## ⚠️ CRITICAL - Must Complete Before Launch

### 1. API Keys & Credentials
- [ ] **Generate NEW production API keys** (never use development keys in production)
  - [ ] New Groq API key
  - [ ] New Google Gemini API keys (primary + backup)
  - [ ] New Firebase project for production
  - [ ] New OpenWeather API key
  - [ ] New Tavily API key (if using)
  - [ ] New Replicate API key (if using)

- [ ] **Secure credential storage**
  - [ ] Store in Vercel environment variables (encrypted)
  - [ ] Never commit `.env` files
  - [ ] Use different keys per environment
  - [ ] Document key rotation schedule

### 2. Firebase Security
- [ ] **Create separate production Firebase project**
  - [ ] Production-only project
  - [ ] Enable billing alerts
  - [ ] Set up budget limits
  
- [ ] **Configure Firebase Security Rules**
  - [ ] Test all Firestore rules
  - [ ] Test Storage rules
  - [ ] Enable audit logging
  
- [ ] **Authentication Settings**
  - [ ] Configure authorized domains
  - [ ] Enable email enumeration protection
  - [ ] Set session timeout (30 days max)
  - [ ] Enable MFA (optional but recommended)

### 3. Environment Configuration
- [ ] **Create production environment file**
  ```bash
  # .env.production (add to .gitignore!)
  GROQ_API_KEY=prod_key_here
  GOOGLE_GENAI_API_KEY=prod_key_here
  GOOGLE_GENAI_API_KEY_BACKUP=prod_key_here
  NEXT_PUBLIC_FIREBASE_API_KEY=prod_key_here
  NEXT_PUBLIC_FIREBASE_PROJECT_ID=prod_project_here
  # ... etc
  ```

- [ ] **Verify environment variables in deployment platform**
  - [ ] All keys present
  - [ ] Correct values
  - [ ] Properly encrypted

### 4. Security Headers
- [ ] **Add security headers in next.config.js**
  ```javascript
  // Recommended headers
  headers: async () => [
    {
      source: '/(.*)',
      headers: [
        {
          key: 'X-Content-Type-Options',
          value: 'nosniff',
        },
        {
          key: 'X-Frame-Options',
          value: 'DENY',
        },
        {
          key: 'X-XSS-Protection',
          value: '1; mode=block',
        },
        {
          key: 'Strict-Transport-Security',
          value: 'max-age=31536000; includeSubDomains',
        },
      ],
    },
  ],
  ```

## 🛡️ IMPORTANT - Highly Recommended

### 5. Rate Limiting Enhancement
- [ ] **Consider Redis-based rate limiting** (for distributed systems)
- [ ] **Monitor rate limit hits** (detect abuse)
- [ ] **Implement IP-based limits** (additional layer)

### 6. Input Validation
- [ ] **Review all user inputs**
  - [x] File upload validation (already implemented)
  - [x] Form field validation (already implemented)
  - [x] API request validation (already implemented)
  
- [ ] **Add Content Security Policy (CSP)**
  ```javascript
  // In next.config.js
  {
    key: 'Content-Security-Policy',
    value: "default-src 'self'; img-src 'self' data: https:; script-src 'self' 'unsafe-eval' 'unsafe-inline';"
  }
  ```

### 7. Error Handling
- [x] **No sensitive data in error messages** (already implemented)
- [x] **Sanitize error outputs** (already implemented)
- [ ] **Set up error tracking** (Sentry recommended)

### 8. Database Security
- [x] **Firestore rules tested** (already configured)
- [ ] **Enable backup schedule** (Firebase Console)
- [ ] **Set up access logs** (Firebase Console)
- [ ] **Monitor for anomalous queries**

## 📊 MONITORING - Set Up After Launch

### 9. Logging & Monitoring
- [ ] **Error tracking**
  - [ ] Sentry for error monitoring
  - [ ] Alert on critical errors
  - [ ] Daily error report

- [ ] **Performance monitoring**
  - [ ] Vercel Analytics
  - [ ] Core Web Vitals tracking
  - [ ] API response times

- [ ] **Security monitoring**
  - [ ] Failed authentication attempts
  - [ ] Rate limit violations
  - [ ] Unusual access patterns

### 10. Regular Security Tasks
- [ ] **Weekly reviews**
  - [ ] Check error logs
  - [ ] Review access patterns
  - [ ] Monitor API usage

- [ ] **Monthly tasks**
  - [ ] Update dependencies
  - [ ] Review security advisories
  - [ ] Check for new CVEs

- [ ] **Quarterly tasks**
  - [ ] Rotate API keys
  - [ ] Full security audit
  - [ ] Penetration testing (if budget allows)

## 🔄 Deployment Checklist

### Before Deployment
- [ ] Run `npm audit` and fix vulnerabilities
- [ ] Run production build locally (`npm run build`)
- [ ] Test production build (`npm run start`)
- [ ] Run Lighthouse audit (aim for 90+ score)
- [ ] Test all critical user flows
- [ ] Verify all API endpoints work
- [ ] Check mobile responsiveness

### During Deployment
- [ ] Deploy to staging environment first
- [ ] Run smoke tests on staging
- [ ] Deploy to production
- [ ] Verify all environment variables loaded
- [ ] Test authentication flow
- [ ] Test payment flow (if applicable)

### After Deployment
- [ ] Monitor error rates (first 24 hours)
- [ ] Check performance metrics
- [ ] Verify CDN and caching working
- [ ] Test PWA installation
- [ ] Send test transactions

## 🚨 Incident Response Plan

### If Security Breach Detected
1. **Immediate Actions**
   - Disable affected API keys
   - Block suspicious IP addresses
   - Enable maintenance mode if needed

2. **Investigation**
   - Check access logs
   - Identify breach scope
   - Document timeline

3. **Remediation**
   - Rotate all credentials
   - Patch vulnerabilities
   - Notify affected users (if required by law)

4. **Post-Incident**
   - Conduct post-mortem
   - Update security procedures
   - Implement additional safeguards

## 📋 Production Environment Variables

### Required Variables
```bash
# AI APIs (Primary)
GROQ_API_KEY=                    # Primary recommendation engine
GOOGLE_GENAI_API_KEY=            # Backup AI provider
GOOGLE_GENAI_API_KEY_BACKUP=     # Secondary backup

# Firebase Configuration (NEXT_PUBLIC = client-side)
NEXT_PUBLIC_FIREBASE_API_KEY=
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=
NEXT_PUBLIC_FIREBASE_PROJECT_ID=
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=
NEXT_PUBLIC_FIREBASE_APP_ID=

# Firebase Admin (server-side only)
FIREBASE_SERVICE_ACCOUNT_KEY=    # JSON string, never expose

# Optional Services
OPENWEATHER_API_KEY=             # Weather integration
TAVILY_API_KEY=                  # Shopping links
REPLICATE_API_TOKEN=             # Premium image generation
HUGGINGFACE_API_KEY=             # Fallback image generation

# Monitoring (Optional)
SENTRY_DSN=                      # Error tracking
NEXT_PUBLIC_POSTHOG_KEY=         # Analytics
```

## ✅ Security Checklist Summary

**Before Launch:**
- [ ] All new production API keys generated
- [ ] Separate Firebase production project created
- [ ] Environment variables configured in hosting platform
- [ ] Security headers added
- [ ] Firestore rules tested
- [ ] All tests passing

**After Launch:**
- [ ] Monitoring tools configured
- [ ] Error tracking active
- [ ] Performance monitoring active
- [ ] Regular security reviews scheduled
- [ ] Key rotation schedule documented

## 🎯 Security Maturity Levels

### Level 1: Minimum Viable Security (Current)
- ✅ Environment variables secured
- ✅ Input validation
- ✅ Rate limiting
- ✅ Authentication
- ✅ Error handling

### Level 2: Production Security (Recommended)
- [ ] Separate production environment
- [ ] Security headers
- [ ] Error monitoring
- [ ] Regular updates
- [ ] Backup strategy

### Level 3: Enterprise Security (Optional)
- [ ] WAF (Web Application Firewall)
- [ ] DDoS protection (Cloudflare)
- [ ] Penetration testing
- [ ] SOC 2 compliance
- [ ] Bug bounty program

---

**Status:** Ready for Level 1 ✅  
**Next Step:** Implement Level 2 recommendations before public launch

*Last Updated: February 7, 2026*
