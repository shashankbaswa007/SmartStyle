# Multi-AI System with Groq Primary Setup Guide

## Overview
Your SmartStyle application now has **Groq as PRIMARY** with **14,500+ requests per day**! Groq's massive free quota (14,400/day) makes it the perfect primary engine, with Gemini as backup.

## Architecture

### 3-Tier Recommendation System (Groq First!)
```
1️⃣ Groq AI PRIMARY (14,400/day) ⚡
   - FREE forever
   - Llama 3.3 70B model
   - Uses user inputs (no vision)
   - Very fast responses
   ↓ Failed or not configured
   
2️⃣ Gemini AI Backup (100/day) 🆕
   - Has vision (analyzes images)
   - High quality recommendations
   - Uses 2 API keys (50 each)
   - Auto-switches between keys
   ↓ All failed
   
3️⃣ Error Message
   - Friendly error message
   - User can try again later
```

### 4-Tier Image Generation System
```
1️⃣ Gemini 2.0 Flash Primary (50/day) - Experimental
   - Model: gemini-2.0-flash
   - Attempting image generation (likely won't work)
   - Will fall back to Pollinations.ai
   ↓ Quota exceeded or doesn't support images
   
2️⃣ Gemini 2.0 Flash Backup (50/day) - Experimental
   - Model: gemini-2.0-flash
   - Second Gemini API key
   - Auto-switches when primary exhausted
   ↓ Both Gemini keys exhausted or don't support images
   
3️⃣ Pollinations.ai (Unlimited) ✅ RELIABLE
   - FREE AI image generation
   - Stable Diffusion Flux model
   - No API key needed
   - URL-based generation
   ↓ Failed
   
4️⃣ Placeholder
   - Always works
   - Graceful degradation
```

## Setup Instructions

### Step 1: Get Gemini API Keys (2 keys)

**Primary Key:**
1. Visit: https://aistudio.google.com/app/apikey
2. Sign in with Google account
3. Click "Create API Key"
4. Copy the key

**Backup Key:**
1. Same URL: https://aistudio.google.com/app/apikey
2. Can use same Google account OR different account
3. Click "Create API Key" again
4. Copy this second key

### Step 2: Get Groq API Key
1. Visit: https://console.groq.com/
2. Sign up (no credit card required!)
3. Click on "API Keys" in the sidebar
4. Click "Create API Key"
5. Give it a name (e.g., "SmartStyle")
6. Copy the key (starts with `gsk_...`)

### Step 2: Get Groq API Key
1. Visit: https://console.groq.com/
2. Sign up (no credit card required!)
3. Click on "API Keys" in the sidebar
4. Click "Create API Key"
5. Give it a name (e.g., "SmartStyle")
6. Copy the key (starts with `gsk_...`)

### Step 3: Add to Environment
Open your `.env.local` file and add all three keys:
```bash
# Primary Gemini (50/day)
GOOGLE_GENAI_API_KEY=your_primary_gemini_key_here

# Backup Gemini (50/day) - Auto-switches when primary exhausted
GOOGLE_GENAI_API_KEY_BACKUP=your_backup_gemini_key_here

# Groq Fallback (14,400/day) - Used when both Gemini keys exhausted
GROQ_API_KEY=gsk_your_actual_key_here
```

### Step 4: Restart Dev Server
```bash
npm run dev
```

That's it! The fallback is now active.

## Testing the Fallback

### Test Groq Integration
You can test if Groq is working by temporarily commenting out the Gemini key:

1. In `.env.local`, comment out Gemini:
```bash
# GOOGLE_GENAI_API_KEY=your_key  # Temporarily disabled for testing
GROQ_API_KEY=gsk_your_actual_key_here
```

2. Restart server: `npm run dev`
3. Try generating recommendations
4. You should see "⚡ Powered by Groq AI (Llama 3.1 70B)" badge
5. Restore Gemini key after testing

### Check Console Logs
When Groq activates, you'll see:
```
🚀 Using Groq AI as primary recommendation engine (14,400/day FREE)...
✅ Groq response received - recommendations generated successfully!
✅ Generated 3 outfit recommendations via Groq
```

When Gemini attempts image generation:
```
🎨 Generating 3 outfit images...
🔑 Available Gemini quota: 100 requests
🔄 Trying gemini-2.0-flash with Primary Gemini...
⚠️ gemini-2.0-flash returned no image data, attempt 1/3

# Expected: Will fail and fall back to Pollinations.ai
🤖 Attempting Pollinations.ai AI generation...
✅ Generated AI image with Pollinations.ai
📊 Image generation summary: Gemini: 0, Pollinations: 3
```

When model is not available or doesn't support images:
```
⚠️ gemini-2.0-flash doesn't support image generation
🤖 Attempting Pollinations.ai AI generation...
✅ Generated AI image with Pollinations.ai
```
```
🎨 Generating 3 outfit images...
� Available Gemini quota: 100 requests
🔄 Trying gemini-2.5-flash with Primary Gemini...
✅ Generated image with gemini-2.5-flash using Primary Gemini
📊 Image generation summary: Gemini: 3, Pollinations: 0
```

When Gemini quota is exhausted:
```
⚠️ Primary Gemini quota exceeded for images
✅ Switched to Backup Gemini
🔄 Retrying with Backup Gemini...
✅ Generated image with gemini-2.5-flash using Backup Gemini
```

When all Gemini keys exhausted:
```
💡 All Gemini keys exhausted, will try Pollinations.ai fallback
🤖 Attempting Pollinations.ai AI generation...
✅ Generated AI image with Pollinations.ai
📊 Image generation summary: Gemini: 100, Pollinations: 3
```

## What Changed

### New Files
1. **`src/lib/multi-gemini-client.ts`** 🆕 - Multi-key Gemini manager
   - `MultiGeminiManager` class - Manages 2 Gemini API keys
   - `getNextAvailableKey()` - Returns current available key
   - `markCurrentKeyExhausted()` - Auto-switches to backup key
   - `getTotalAvailableQuota()` - Sum of all available quotas
   - `getKeysSummary()` - Status report of all keys

2. **`src/lib/pollinations-client.ts`** 🆕 - FREE AI image generation
   - `generateImageWithPollinations()` - Generate via URL
   - `buildFashionPrompt()` - Optimize prompts for fashion
   - No API key needed - uses URL parameters
   - Unlimited FREE requests

3. **`src/lib/groq-client.ts`** - Groq API integration
   - `generateRecommendationsWithGroq()` - Generate recommendations
   - `isGroqConfigured()` - Check if API key exists
   - Updated to Llama 3.3 70B (from deprecated 3.1)

### Modified Files
1. **`src/ai/flows/analyze-image-and-provide-recommendations.ts`**
   - Added Groq fallback logic
   - Converts Groq response to match Gemini format
   - Added `provider` field to output schema

2. **`src/ai/flows/generate-outfit-image.ts`** 🆕
   - Integrated multi-Gemini key manager
   - Auto-switches between Gemini keys on quota
   - Falls back to Pollinations.ai when Gemini exhausted
   - Removed Pexels integration
   - Logs key usage and switching

3. **`src/components/style-advisor.tsx`** 🆕
   - Updated image sources from 'pexels' to 'pollinations'
   - Removed photographer attribution state
   - Simplified state management

4. **`src/components/style-advisor-results.tsx`** 🆕
   - Updated image attribution display
   - Shows "🤖 AI Generated (Gemini)" for Gemini images
   - Shows "🤖 AI Generated via Pollinations.ai" for Pollinations
   - Removed Pexels photographer credits
   - Shows AI provider badge for recommendations

5. **`.env.local.example`** 🆕
   - Added `GOOGLE_GENAI_API_KEY_BACKUP` setup
   - Removed Pexels API key section
   - Added Pollinations.ai note (no key needed)
   - Updated quota totals

### Deleted Files
1. **`src/lib/pexels.ts`** ❌ - No longer needed
   - Replaced with Pollinations.ai
   - All references removed

## Provider Badge
Users will now see which AI generated their content:

**Recommendations:**
- **Gemini Badge**: 🤖 Powered by Gemini AI
- **Groq Badge**: ⚡ Powered by Groq AI (Llama 3.3 70B)

**Images:**
- **Gemini Badge**: 🤖 AI Generated (Gemini)
- **Pollinations Badge**: 🤖 AI Generated via Pollinations.ai
- **Placeholder**: 🎨 Placeholder

This transparency helps users understand which AI is being used.

## Quota Summary

### FREE Daily Limits (Groq First!)
| Service | Primary | Backup | Total |
|---------|---------|--------|-------|
| AI Recommendations | **Groq: 14,400** ⚡ | Gemini: 100 | **14,500** |
| AI Images | Gemini: 100 | Pollinations: ∞ | **Unlimited** |
| Weather | OpenWeather: 1,000 | - | 1,000 |

**Strategy**: Groq handles 96%+ of recommendations (FREE!), Gemini is rare backup

### Cost
**$0.00** - Everything is completely FREE forever!

## Key Differences

### Groq (Primary) vs Gemini (Backup) vs Pollinations

**For Recommendations:**
| Feature | Groq (PRIMARY) ⚡ | Gemini (Backup) |
|---------|-------------------|-----------------|
| Vision | ❌ No | ✅ Yes |
| Speed | ⚡ 10x faster | Normal |
| Quality | Excellent | Excellent |
| Free Quota | **14,400/day** | 100/day (2 keys) |
| Input | Text only | Image + Text |
| Model | llama-3.3-70b-versatile | gemini-2.0-flash-exp |
| Cost | $0 Forever | $0 (limited) |

**Why Groq First?**
- 144x more quota than single Gemini key
- Same quality recommendations
- Much faster responses
- Still uses all user context (occasion, weather, colors, preferences)
- Saves Gemini quota for when you really need vision

**For Images:**
| Feature | Gemini (Primary/Backup) | Pollinations.ai (Fallback) |
|---------|------------------------|----------------------------|
| API Key | ✅ Required | ❌ Not needed |
| Generation | AI (Gemini Imagen) | AI (Stable Diffusion Flux) |
| Quality | Excellent | Excellent |
| Free Quota | 100/day (2 keys) | Unlimited ∞ |
| Speed | Normal | Fast |
| Setup | Requires key | URL-based, instant |

**Note**: Groq doesn't have vision, so it uses user form inputs (occasion, weather, colors, preferences) instead of analyzing the uploaded image. Quality remains high because all the context is still available.

## Troubleshooting

### "Groq not configured" Error
- Make sure `GROQ_API_KEY` is set in `.env.local`
- Key should start with `gsk_`
- Restart dev server after adding key

### Groq Fallback Not Activating
- Groq only activates when Gemini quota is exceeded
- Check console for "quota exceeded" or "429" errors
- Manually test by commenting out Gemini key

### Rate Limits
If you hit Groq's rate limits:
- **Per minute**: 30 requests
- **Per hour**: 600 requests
- **Per day**: 14,400 requests

Wait a few minutes and try again.

## Support

### Groq Console
- Dashboard: https://console.groq.com/
- API Keys: https://console.groq.com/keys
- Docs: https://console.groq.com/docs

### Community
- Groq Discord: Join for support and updates
- Documentation: Comprehensive API docs available

## Future Improvements

Potential enhancements:
- [ ] Add personalization support in Groq prompts
- [ ] Cache common recommendations
- [ ] Add user preference for AI provider
- [ ] Smart routing based on request type

## Questions?

If you have any questions about the Groq integration:
1. Check console logs for error details
2. Verify API key is correct
3. Test with simple requests first
4. Check Groq console for usage stats

---

**Congratulations!** 🎉 You now have a robust, FREE AI fallback system with **14,450 daily requests** at absolutely no cost!
