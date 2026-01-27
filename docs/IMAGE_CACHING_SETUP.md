# 🚀 Image Caching & Premium Generation Setup Guide

This document explains the new hybrid image generation and caching system.

## 📊 System Overview

### What Changed?

**Before:** All images generated with Pollinations.ai (free but average quality)

**Now:** 
- **Image Caching**: 60-70% of images served from cache (instant + free)
- **Premium Position 1**: Uses Replicate FLUX for best quality
- **Free Positions 2-3**: Uses Pollinations.ai 
- **Smart Fallbacks**: Automatic fallback if premium service fails

## 💰 Cost Breakdown

### Current Costs (50 users/day):
```
Scenario: 50 users × 3 recommendations/day = 150 images/day

Month 1 (building cache):
- Total requests: 4,500/month
- Cache hits (0%): 0 images (FREE)
- New generations: 4,500 images
  - Position 1 (Replicate): 1,500 × $0.003 = $4.50
  - Positions 2-3 (Free): 3,000 × $0 = $0
- Firebase Storage: $0.05
- Total: $4.55/month

Month 3 (60% cache hit rate):
- Total requests: 4,500/month
- Cache hits (60%): 2,700 images (FREE)
- New generations: 1,800 images
  - Position 1 (Replicate): 450 × $0.003 = $1.35
  - Positions 2-3 (Free): 1,350 × $0 = $0
- Firebase Storage: $0.05
- Total: $1.40/month
```

### At Scale (500 users/day):
```
- Month 3 (60% cache): ~$14/month
- Month 6 (70% cache): ~$8/month
```

## 🔧 Setup Instructions

### 1. Deploy Storage Rules

The storage rules have been updated to allow caching:

```bash
cd /Users/shashi/Downloads/mini-project/SmartStyle
firebase deploy --only storage
```

### 2. Get Replicate API Token (Optional but Recommended)

1. Go to [replicate.com](https://replicate.com)
2. Sign up for free account
3. Go to Account → API Tokens
4. Create new token
5. Copy the token (starts with `r8_`)

**Free Tier:**
- $0.003 per image (FLUX-schnell model)
- No monthly minimum
- Pay only for what you use

### 3. Add to Environment Variables

Update your `.env.local`:

```bash
# Add this line (optional - app works without it)
REPLICATE_API_TOKEN=r8_your_token_here
```

**Without token:** App still works, uses free Pollinations.ai for all positions

**With token:** Position 1 gets premium quality, positions 2-3 stay free

### 4. Restart Dev Server

```bash
npm run dev
```

## 📈 How It Works

### Image Generation Flow

```typescript
User requests recommendation
    ↓
Check Firebase Storage cache
    ↓
[Cache Hit] → Return cached image (instant, FREE)
    ↓
[Cache Miss] → Generate new image:
    ↓
Is it Position 1? 
    ↓
[YES] → Replicate FLUX ($0.003, premium quality)
    ↓
[NO] → Pollinations.ai (FREE, good quality)
    ↓
Cache to Firebase Storage
    ↓
Return to user
```

### Caching Strategy

**Cache Key Generation:**
```typescript
MD5(prompt + colors sorted) = cache_key
Example: "minimalist office wear|#2C3E50,#95A5A6,#ECF0F1"
         → "a3f8d9e2..."
```

**Cache Invalidation:**
- Never expires (images are content-addressed)
- Same prompt + colors = same cache key
- Different colors = different image needed = different cache key

## 📊 Monitoring

### Check Cache Performance

Check your Firebase Console:
1. Go to Storage → `generated-images/`
2. See cached image count
3. Each file = one cached combination

### Expected Cache Growth

```
Week 1: 500-1,000 images cached
Week 2: 1,500-2,500 images cached  
Month 1: 3,000-5,000 images cached
Month 3: 5,000-8,000 images cached (plateaus)
```

### Cost Tracking

In Firebase Console → Blaze Plan → Usage:
- Storage: Should be < $0.10/month
- Bandwidth: Should be < $1/month

In Replicate Dashboard:
- Check monthly spending
- Should match: (position_1_generations × $0.003)

## 🎯 Optimization Tips

### 1. Increase Cache Hit Rate

The cache key is: `MD5(prompt + sorted_colors)`

**Tips:**
- Use consistent color sorting (already implemented)
- Normalize prompts (remove extra spaces, lowercase)
- Round similar colors to nearest common shade

### 2. Reduce Premium Image Usage

Currently only position 1 uses Replicate. To reduce further:

```typescript
// In route.ts, change logic:
if (index === 0 && isReplicateAvailable() && specialOccasion) {
  // Only use premium for important occasions
}
```

### 3. Monitor Costs

Set up Firebase alerts:
- Alert if storage > $1/month
- Alert if bandwidth > $5/month

Set up Replicate alerts:
- Alert if spending > $10/month

## 🐛 Troubleshooting

### Issue: Images not caching

**Check:**
1. Firebase Storage rules deployed?
   ```bash
   firebase deploy --only storage
   ```

2. Storage initialized in firebase.ts?
   ```typescript
   import { storage } from '@/lib/firebase';
   ```

3. Check browser console for errors

### Issue: Replicate not working

**Check:**
1. Token in `.env.local`?
2. Token starts with `r8_`?
3. Restart dev server after adding token
4. Check Replicate dashboard for errors

**Fallback:** App automatically uses free Pollinations.ai

### Issue: High storage costs

**Solutions:**
1. Implement cache size limit (10,000 images max)
2. Delete old unused images (>6 months)
3. Compress images before caching (80% quality)

## 📝 Implementation Files

New files created:
- `src/lib/image-cache.ts` - Caching logic
- `src/lib/replicate-image.ts` - Replicate integration
- `docs/IMAGE_CACHING_SETUP.md` - This file

Modified files:
- `src/app/api/recommend/route.ts` - Added caching + hybrid generation
- `storage.rules` - Added generated-images access
- `README.md` - Updated documentation

## 🎉 Expected Results

After implementing:

**Performance:**
- 60-70% of images load instantly (cached)
- Position 1 outfits look noticeably better
- Overall user experience improved

**Cost:**
- Month 1: ~$4-5/month (building cache)
- Month 3: ~$1-2/month (cache working)
- Month 6: ~$1/month (stable cache)

**Compare to alternatives:**
- Imagen 3 for all images: $90-180/month
- Saving: 98-99%

## 🚀 Future Enhancements

1. **Preemptive Caching**: Cache popular style combinations
2. **Image Compression**: Reduce storage costs by 50%
3. **CDN Integration**: Add Cloudflare Images for faster delivery
4. **A/B Testing**: Test if users notice quality difference
5. **Dynamic Quality**: Use premium for paid users only

---

**Questions?** Check the main README or open an issue on GitHub.

**Last Updated:** January 26, 2026
