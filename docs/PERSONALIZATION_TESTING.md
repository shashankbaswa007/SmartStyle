/**
 * Personalization Testing Guide
 * 
 * This document explains how to test the AI personalization feature end-to-end.
 */

## Testing the Personalization Flow

### Prerequisites
1. Firebase authentication must be working
2. Firestore database must be accessible
3. User must be logged in

### Test Scenario 1: First-Time User (No Preferences)

**Steps:**
1. Log in as a new user
2. Upload an outfit photo
3. Provide occasion (e.g., "casual brunch")
4. Get 3 outfit recommendations
5. **Action:** Click 👍 on Outfit 1 (e.g., it has blue and white colors)
6. Click 👎 on Outfit 2 (e.g., it has red colors)

**Expected Result:**
- Feedback submits successfully
- Toast notification appears
- Check Firestore `userPreferences/{userId}`:
  - `favoriteColors` should include colors from Outfit 1
  - `dislikedColors` should include colors from Outfit 2

7. **Upload another outfit** with same occasion
8. **Expected:** New recommendations should:
   - Favor blue/white colors (from Outfit 1)
   - Avoid red colors (from Outfit 2)

### Test Scenario 2: Returning User (With Preferences)

**Setup:** User already has preferences:
- Favorite colors: ["blue", "navy", "white"]
- Disliked colors: ["bright red", "neon yellow"]
- Preferred styles: ["minimalist", "casual"]

**Steps:**
1. Upload outfit photo
2. Provide occasion: "coffee date"
3. Get recommendations

**Expected Results:**
- Recommendations should prominently feature blue, navy, white
- No bright red or neon yellow in suggestions
- Style should lean toward minimalist/casual
- Color suggestions should align with favorites

**Verification:**
- Check the AI response in browser DevTools Network tab
- Look for personalization data being sent to AI
- Verify color palette matches preferences

### Test Scenario 3: Seasonal Adaptation

**Steps:**
1. Check current date → Determine season (Spring/Summer/Fall/Winter)
2. Upload outfit
3. Get recommendations

**Expected Results:**
- Spring (March-May): Light layers, pastels, florals
- Summer (June-August): Light fabrics, bright colors, breathable
- Fall (September-November): Earth tones, layers, warmer fabrics
- Winter (December-February): Warm colors, heavy fabrics, layers

**Verification:**
Check Firestore `recommendationHistory` document:
```json
{
  "season": "summer",  // Should match current season
  // ...
}
```

### Test Scenario 4: Occasion Memory

**Setup:**
1. Upload outfit for "wedding guest"
2. Like an outfit (e.g., elegant dress with gold accessories)
3. Mark as "wore it"

**Later:**
1. Upload new outfit for "wedding guest" again
2. Get recommendations

**Expected:**
- AI should reference past successful wedding outfit
- Similar elegant style with gold accents suggested
- Prompt should mention "based on past success"

### Test Scenario 5: Detailed Feedback

**Steps:**
1. Get outfit recommendations
2. Click 👍 on an outfit
3. Click "Add details" button
4. Give 5-star rating
5. Toggle "Mark as worn"
6. Add note: "Loved the color combination, perfect for date night"
7. Submit

**Expected Results:**
- Detailed feedback dialog closes
- Toast shows success message
- Check Firestore `recommendationHistory/{recId}`:
```json
{
  "feedback": {
    "liked": ["outfit1"],
    "disliked": [],
    "rating": 5,
    "worn": true,
    "notes": "Loved the color combination, perfect for date night",
    "feedbackAt": <timestamp>
  }
}
```

### Test Scenario 6: Style Evolution

**Long-term test (10+ recommendations):**

1. Start with no preferences
2. Over 10 recommendations, consistently like outfits with:
   - Earth tones (brown, beige, olive)
   - Minimalist style
   - Casual occasions

**Expected Evolution:**
- Recommendations 1-3: Generic, varied styles
- Recommendations 4-6: Starting to favor earth tones
- Recommendations 7-10: Strongly personalized
  - Majority earth tone suggestions
  - Minimalist style dominant
  - Casual-appropriate by default

**Verification:**
Query user preferences over time:
```javascript
// Check how preferences build up
const prefs = await getUserPreferences(userId);
console.log(prefs.favoriteColors); // Should show earth tones
console.log(prefs.preferredStyles); // Should include "minimalist"
```

## Manual Firestore Inspection

### Check User Preferences
1. Open Firebase Console
2. Navigate to Firestore Database
3. Go to `userPreferences` collection
4. Find document with your user ID
5. Verify structure:

```json
{
  "userId": "abc123",
  "favoriteColors": ["blue", "navy", "white"],
  "dislikedColors": ["red", "yellow"],
  "preferredStyles": ["minimalist", "casual"],
  "avoidedStyles": [],
  "occasionPreferences": {
    "wedding": {
      "preferredItems": ["dress", "heels"],
      "preferredColors": ["gold", "navy"],
      "notes": "Elegant formal look"
    }
  },
  "seasonalPreferences": {
    "summer": ["linen", "cotton", "light colors"],
    // ...
  },
  "totalRecommendations": 5,
  "createdAt": <timestamp>,
  "updatedAt": <timestamp>
}
```

### Check Recommendation History
1. Navigate to `recommendationHistory` collection
2. Find recent documents
3. Verify structure includes:
   - User ID
   - Occasion
   - Weather
   - Season
   - 3 outfit recommendations with colors, items, images
   - Feedback object (if user provided feedback)

## Browser DevTools Testing

### Network Tab
1. Open DevTools → Network tab
2. Upload outfit and submit
3. Look for request to AI flow
4. Check request payload:
   - Should include `userId`
   - Should include `personalizationData` (if user has preferences)

### Console Logs
Enable verbose logging:
```javascript
// In browser console
localStorage.setItem('debug', 'personalization:*');
```

Look for logs:
- "Fetching personalization context for user: {userId}"
- "User preferences found: {...}"
- "Seasonal preferences: summer"
- "Occasion memory available for: wedding"

## Automated Test Cases

### Unit Tests (Future)
```typescript
describe('Personalization Service', () => {
  test('saves recommendation correctly', async () => {
    const recId = await saveRecommendation(userId, recommendation);
    expect(recId).toBeDefined();
  });

  test('updates preferences on feedback', async () => {
    await submitRecommendationFeedback(recId, userId, {
      liked: ['outfit1'],
    });
    const prefs = await getUserPreferences(userId);
    expect(prefs.favoriteColors.length).toBeGreaterThan(0);
  });

  test('gets correct season for hemisphere', () => {
    const season = getCurrentSeason();
    expect(['spring', 'summer', 'fall', 'winter']).toContain(season);
  });
});
```

## Common Issues & Solutions

### Issue: Preferences not updating
**Solution:**
- Check Firestore rules allow writes
- Verify user authentication
- Check browser console for errors
- Ensure recommendation ID is valid

### Issue: AI not using personalization data
**Solution:**
- Verify userId is passed to AI flow
- Check that getPersonalizationContext() is called
- Inspect network request to confirm personalization data included
- Check AI prompt template for correct Handlebars syntax

### Issue: Feedback buttons not showing
**Solution:**
- Ensure recommendationId is not null
- Verify user is authenticated
- Check StyleAdvisorResults receives recommendationId prop

### Issue: Colors not being learned correctly
**Solution:**
- Verify color extraction from outfit recommendations
- Check that colors are valid hex codes
- Ensure updatePreferencesFromFeedback() is called
- Inspect Firestore to see actual saved colors

## Success Metrics

After successful implementation, you should see:

1. **Immediate (1-3 recommendations):**
   - Feedback buttons work
   - Preferences saved to Firestore
   - Toast notifications appear

2. **Short-term (3-5 recommendations):**
   - Color preferences starting to influence suggestions
   - Disliked colors being avoided
   - Seasonal adaptation visible

3. **Medium-term (5-10 recommendations):**
   - Noticeable personalization in recommendations
   - Consistent style alignment
   - Occasion memory working

4. **Long-term (10+ recommendations):**
   - Highly personalized suggestions
   - Style evolution tracking useful
   - Wardrobe gap analysis accurate

## Performance Benchmarks

- **Recommendation save time:** < 500ms
- **Feedback submission:** < 300ms
- **Personalization context fetch:** < 200ms
- **AI recommendation with personalization:** 5-10 seconds (same as without)

## Next Steps After Testing

Once basic testing confirms everything works:

1. **Add analytics dashboard** to visualize preferences
2. **Implement preference editing UI** for manual adjustments
3. **Add A/B testing** for recommendation algorithms
4. **Create email notifications** for wardrobe gap suggestions
5. **Build social features** for outfit sharing

---

**Last Updated:** January 2025
**Version:** 1.0.0
