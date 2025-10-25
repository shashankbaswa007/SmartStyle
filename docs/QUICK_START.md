# Quick Start Guide - Advanced AI Personalization

## 🚀 How to Use the New Features

### For Users

#### 1. Getting Personalized Recommendations

**First Time:**
1. Go to **Style Check** (click profile icon → Style Check)
2. Upload an outfit photo
3. Fill in occasion and style preferences
4. Get 3 outfit recommendations

**Provide Feedback:**
1. Below each outfit, you'll see 👍 and 👎 buttons
2. Click 👍 if you like the outfit → System learns colors/styles
3. Click 👎 if you don't → System avoids those colors
4. (Optional) Click "Add details" for rating and notes

**Next Time:**
1. Upload another outfit
2. **Recommendations will be personalized** based on your feedback!
3. More feedback = Better recommendations

#### 2. View Your Analytics

**Access:**
- Click profile icon (top right)
- Select **"Analytics"**

**What You'll See:**
- 📊 Total recommendations count
- 💬 Feedback given count
- ❤️ Your like rate percentage
- 🎨 Favorite colors with visual swatches
- 📅 Top occasions you style for
- 🌈 Seasonal distribution
- ⭐ Style preferences (preferred & avoided)

**Tips:**
- More feedback = Better analytics
- Check back regularly to see style evolution
- Use insights to understand your fashion preferences

#### 3. Navigation

**Quick Access Menu:**
- Profile Icon → **Style Check** (analyze outfits)
- Profile Icon → **My Wardrobe** (manage items)
- Profile Icon → **Analytics** (view insights)
- Profile Icon → **Account Settings**

---

### For Developers

#### File Structure

```
SmartStyle/
├── src/
│   ├── lib/
│   │   └── personalization.ts          # Core service (8 functions)
│   ├── components/
│   │   ├── RecommendationFeedback.tsx  # Feedback UI
│   │   ├── style-advisor.tsx           # Updated with tracking
│   │   ├── style-advisor-results.tsx   # Updated with feedback
│   │   └── auth/
│   │       └── UserProfileDropdown.tsx # Updated navigation
│   ├── ai/
│   │   └── flows/
│   │       └── analyze-image-and-provide-recommendations.ts  # AI integration
│   └── app/
│       └── analytics/
│           └── page.tsx                # Analytics dashboard
└── docs/
    ├── AI_PERSONALIZATION.md           # Full documentation
    ├── PERSONALIZATION_TESTING.md      # Testing guide
    └── IMPLEMENTATION_COMPLETE.md      # This summary
```

#### Key Functions

**`personalization.ts`:**
```typescript
// Save a recommendation
await saveRecommendation(userId, recommendationData);

// Submit user feedback
await submitRecommendationFeedback(recId, userId, {
  liked: ['outfit1'],
  disliked: ['outfit2'],
  rating: 5,
  worn: true
});

// Get user preferences for AI
const context = await getPersonalizationContext(userId, occasion);

// Get recommendation history
const history = await getRecommendationHistory(userId, 50);

// Get user preferences
const prefs = await getUserPreferences(userId);
```

#### Data Flow

```
1. User uploads outfit
2. AI analyzes → generates 3 recommendations
3. System calls saveRecommendation() → Firestore
4. User sees recommendations + feedback buttons
5. User clicks feedback → submitRecommendationFeedback()
6. Preferences updated automatically
7. Next upload → AI gets context via getPersonalizationContext()
8. Personalized recommendations generated
```

#### Testing Locally

```bash
# Build and check for errors
npm run build

# Run development server
npm run dev

# Open browser
open http://localhost:3000

# Test flow:
# 1. Sign in
# 2. Upload outfit → /style-check
# 3. Click feedback buttons
# 4. Upload again (see personalization)
# 5. Check analytics → /analytics
```

#### Firestore Collections

**`userPreferences`:**
- Document ID: User UID
- Fields: favoriteColors, dislikedColors, preferredStyles, etc.

**`recommendationHistory`:**
- Document ID: Auto-generated
- Fields: userId, occasion, recommendations, feedback, etc.

#### Environment Variables Required

```env
# Firebase
NEXT_PUBLIC_FIREBASE_API_KEY=
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=
NEXT_PUBLIC_FIREBASE_PROJECT_ID=
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=
NEXT_PUBLIC_FIREBASE_APP_ID=

# Google AI
GOOGLE_GENAI_API_KEY=

# Others
TAVILY_API_KEY=
OPENWEATHER_API_KEY=
```

---

## 🔧 Troubleshooting

### "Feedback not saving"
**Check:**
1. User is authenticated
2. Firestore rules allow writes
3. recommendationId is valid
4. Browser console for errors

**Fix:**
- Verify Firebase auth working
- Check Firestore rules
- Ensure recommendationId passed correctly

### "Analytics showing no data"
**Check:**
1. User has provided feedback
2. recommendationHistory collection exists
3. userId matches authenticated user

**Fix:**
- Upload outfit and provide feedback first
- Check Firestore for collections
- Verify authentication

### "AI not personalizing"
**Check:**
1. userId passed to AI flow
2. getPersonalizationContext() called
3. User has preferences in Firestore

**Fix:**
- Verify style-advisor.tsx passes userId
- Check console for personalization logs
- Provide more feedback to build preferences

---

## 📊 Analytics Explained

### Metrics

**Total Recommendations:**
- Count of all outfits analyzed
- Shows engagement level

**Feedback Given:**
- Count of recommendations with feedback
- Higher = better personalization

**Like Rate:**
- Percentage of outfits liked
- Target: >60% for good personalization
- Lower initially, improves over time

**Wardrobe Gaps:**
- Missing essential items
- Future feature for smart suggestions

### Visualizations

**Color Preferences:**
- Shows colors from liked outfits
- Larger bars = more frequently liked
- Helps understand color tendencies

**Top Occasions:**
- Events styled for most
- Helps optimize for common needs

**Seasonal Distribution:**
- Recommendations by season
- Tracks usage patterns

---

## 🎯 Best Practices

### For Users

1. **Provide Feedback Consistently**
   - Like/dislike after each recommendation
   - More feedback = better results

2. **Be Specific**
   - Use detailed notes when helpful
   - Rate outfits honestly

3. **Check Analytics Regularly**
   - See your style evolution
   - Understand preferences better

4. **Try Different Occasions**
   - Build diverse preference profile
   - Get better variety

### For Developers

1. **Error Handling**
   - Always wrap Firestore calls in try/catch
   - Show user-friendly error messages
   - Log errors for debugging

2. **Performance**
   - Batch Firestore operations when possible
   - Use Firestore indexes for queries
   - Cache user preferences client-side

3. **Testing**
   - Test with multiple user accounts
   - Verify Firestore rules
   - Check AI prompt variations

4. **Monitoring**
   - Track Firestore usage
   - Monitor AI API calls
   - Watch for errors in logs

---

## 🚀 Next Features (Optional)

1. **Wardrobe Gap Analysis**
   - Implement missing function
   - Add shopping suggestions
   - Link to e-commerce

2. **Style Evolution Timeline**
   - Show preference changes over time
   - Visual timeline component
   - Trend identification

3. **Export Analytics**
   - PDF reports
   - Email summaries
   - Data export

4. **Social Features**
   - Share outfits
   - Get peer feedback
   - Inspiration feed

---

## 📞 Support

### Documentation
- Full docs: `docs/AI_PERSONALIZATION.md`
- Testing guide: `docs/PERSONALIZATION_TESTING.md`
- Implementation: `docs/IMPLEMENTATION_COMPLETE.md`

### Debug Logs
```javascript
// Enable in browser console
localStorage.setItem('debug', 'personalization:*');
```

### Firestore Console
- View data: Firebase Console → Firestore Database
- Check rules: Firebase Console → Firestore → Rules
- Monitor usage: Firebase Console → Usage

---

**Ready to use! Start by uploading an outfit and providing feedback.**

**Questions?** Check the full documentation in `/docs`
