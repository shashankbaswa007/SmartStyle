# Advanced AI Personalization Feature

## Overview
The Advanced AI Personalization feature transforms SmartStyle from providing generic style recommendations to delivering increasingly personalized suggestions based on user preferences, feedback history, and behavioral patterns.

## Implementation Status

### ✅ Phase 1: Core Infrastructure (COMPLETED)

#### 1. Personalization Service (`src/lib/personalization.ts`)
**Status**: Fully implemented

**Key Components**:
- **TypeScript Interfaces**:
  - `UserPreferences`: Stores user style preferences (colors, patterns, fits, brands, occasions)
  - `RecommendationHistory`: Tracks all AI recommendations with metadata
  - `OutfitRecommendation`: Individual outfit details with shopping links
  - `StyleFeedback`: User feedback structure (likes, dislikes, ratings, notes)
  - `SeasonalPreference`: Season-specific style preferences
  - `OccasionMemory`: Past successful outfits for specific occasions

- **Core Functions**:
  - `initializeUserPreferences()`: Sets up new user preferences on signup
  - `saveRecommendation()`: Stores AI recommendations to Firestore
  - `submitRecommendationFeedback()`: Records user feedback and updates preferences
  - `getUserPreferences()`: Retrieves user style preferences with defaults
  - `updateUserPreferences()`: Manual preference updates
  - `getRecommendationHistory()`: Fetches past recommendations
  - `getSeasonalPreferences()`: Determines current season preferences with hemisphere detection
  - `getOccasionMemory()`: Retrieves past successful outfits for occasions
  - `analyzeStyleEvolution()`: Tracks preference changes over time
  - `getWardrobeGaps()`: Identifies missing wardrobe categories
  - `getPersonalizationContext()`: Aggregates personalization data for AI flows

**Features**:
- Automatic preference learning from user feedback
- Seasonal adaptation with hemisphere detection
- Occasion-based outfit memory
- Style evolution tracking
- Wardrobe gap analysis
- Comprehensive error handling

#### 2. Feedback UI Component (`src/components/RecommendationFeedback.tsx`)
**Status**: Fully implemented

**Features**:
- **Quick Feedback**: 👍 Like / 👎 Dislike buttons with instant submission
- **Detailed Feedback Dialog**:
  - 5-star rating system
  - "Wore this outfit" tracking
  - Optional text notes for additional context
- **Visual Feedback**:
  - Animated button interactions with Framer Motion
  - Toast notifications on feedback submission
  - Disabled state after feedback submission
- **Smart Integration**: Automatically updates user preferences based on outfit colors

**User Flow**:
1. User sees outfit recommendation
2. Clicks Like/Dislike button → Quick feedback saved
3. (Optional) Clicks "Add details" → Opens detailed feedback dialog
4. User can add rating, mark as worn, and add notes
5. Feedback saves to Firestore and updates preferences

#### 3. Integration with Style Analysis (`src/components/style-advisor.tsx`)
**Status**: Fully integrated

**Changes Made**:
- Imports `saveRecommendation` and `getCurrentSeason` from personalization service
- Added `recommendationId` state to track saved recommendations
- Modified `performAnalysis()` to:
  - Save recommendations to Firestore after AI analysis
  - Create recommendation history entry with all outfit details
  - Extract and store metadata (weather, occasion, season, colors)
- Pass `recommendationId` to `StyleAdvisorResults` component
- Reset `recommendationId` on form reset

**Data Saved Per Recommendation**:
- 3 outfit recommendations with:
  - Items list
  - Color palette
  - Style genre
  - Description
  - Generated image URL
  - Shopping links (Amazon, Flipkart, Myntra)
  - Wardrobe match indicator
- Image analysis data (detected colors, skin tone, style)
- Context (occasion, weather, season)
- User ID and timestamp

#### 4. Results Display Integration (`src/components/style-advisor-results.tsx`)
**Status**: Fully integrated

**Changes Made**:
- Accepts `recommendationId` prop from parent
- Loads current user on component mount
- Renders `RecommendationFeedback` component below each outfit card
- Feedback shown only when user is authenticated and recommendation ID exists

**UI Structure**:
```
[Outfit Card]
  ├── Generated Image
  ├── Color Palette
  ├── Shopping Links (Amazon, Flipkart, Myntra)
  └── Feedback Section (NEW)
      ├── Like/Dislike Buttons
      └── "Add details" Button (appears after feedback)
```

### 🔄 Phase 2: AI Flow Integration (IN PROGRESS)

#### Next Steps:

1. **Update AI Recommendation Flow** (`src/ai/flows/analyze-image-and-provide-recommendations.ts`)
   - Import `getPersonalizationContext()` from personalization service
   - Call function before generating recommendations
   - Pass user preferences to Gemini prompt:
     ```typescript
     const context = await getPersonalizationContext(userId, occasion);
     // Add to prompt: favorite colors, disliked colors, preferred styles
     ```
   - Improve recommendations based on:
     - Past liked/disliked outfits
     - Seasonal preferences
     - Occasion-specific history

2. **Enhance Prompt Engineering**
   - Include user's favorite colors in color suggestions
   - Avoid disliked colors and styles
   - Reference past successful outfits for similar occasions
   - Suggest complementary items based on wardrobe gaps

### 📊 Phase 3: Analytics & Insights (PENDING)

#### To Be Implemented:

1. **Analytics Dashboard** (`src/app/analytics/page.tsx` - NEW)
   - Style evolution charts (preference changes over time)
   - Most worn outfit types
   - Color preference trends
   - Seasonal style insights
   - Recommendation success rate

2. **Wardrobe Gap Recommendations**
   - Integrate `getWardrobeGaps()` into wardrobe page
   - Suggest missing essential items
   - Provide shopping links for gaps

3. **Occasion-Based Memory**
   - Show past successful outfits when user enters similar occasion
   - "You wore this to a similar event" suggestions

4. **Style Evolution Tracking**
   - Visual timeline of style preference changes
   - Highlight emerging trends in user's preferences

## Database Schema

### Firestore Collections

#### `userPreferences` Collection
```typescript
{
  userId: string,                    // Firebase Auth UID
  favoriteColors: string[],          // Learned from liked outfits
  dislikedColors: string[],          // Learned from disliked outfits
  preferredStyles: string[],         // e.g., "casual", "formal", "streetwear"
  avoidedStyles: string[],
  occasionPreferences: {
    [occasion: string]: {
      preferredItems: string[],
      preferredColors: string[],
      notes?: string
    }
  },
  seasonalPreferences: {
    spring: string[],
    summer: string[],
    fall: string[],
    winter: string[]
  },
  preferredBrands: string[],
  budgetRange: { min: number, max: number },
  fitPreferences: string[],          // "slim", "regular", "oversized"
  totalRecommendations: number,      // Total recommendations received
  createdAt: Timestamp,
  updatedAt: Timestamp
}
```

#### `recommendationHistory` Collection
```typescript
{
  id: string,                        // Auto-generated document ID
  userId: string,
  occasion: string,
  weather: {
    temp: number,
    condition: string
  },
  season: string,
  recommendations: {
    outfit1: OutfitRecommendation,
    outfit2: OutfitRecommendation,
    outfit3: OutfitRecommendation
  },
  feedback: {
    liked: string[],                 // ["outfit1", "outfit3"]
    disliked: string[],              // ["outfit2"]
    selected: string,                // "outfit1"
    worn: boolean,
    rating: number,                  // 1-5 stars
    notes: string
  },
  imageAnalysis: {
    colors: string[],
    skinTone: string,
    style: string
  },
  createdAt: Timestamp,
  feedbackAt: Timestamp
}
```

## User Experience Flow

### First-Time User
1. Upload outfit photo → Get 3 recommendations
2. Like/dislike recommendations → Preferences start building
3. Over 5-10 recommendations → Personalization becomes noticeable

### Returning User
1. Upload photo → AI considers past preferences
2. Recommendations align with favorite colors and styles
3. Seasonal suggestions adapt to current season
4. Similar occasions show "based on past success" outfits

### Power User (20+ recommendations)
1. Highly personalized recommendations
2. Style evolution insights available
3. Wardrobe gap analysis active
4. Accurate seasonal adaptation
5. Occasion memory working well

## Technical Architecture

### Data Flow
```
1. User uploads outfit photo
   ↓
2. AI analyzes image (existing flow)
   ↓
3. Recommendations generated
   ↓
4. saveRecommendation() stores to Firestore ← NEW
   ↓
5. User sees recommendations + feedback buttons ← NEW
   ↓
6. User provides feedback (like/dislike/rating) ← NEW
   ↓
7. submitRecommendationFeedback() updates preferences ← NEW
   ↓
8. Next recommendation uses learned preferences ← FUTURE
```

### Preference Learning Algorithm
```typescript
// When user likes an outfit:
1. Extract colors from liked outfit
2. Add to favoriteColors array (deduplicated)
3. Increment style preference counter
4. Save to occasion memory if marked as worn

// When user dislikes an outfit:
1. Extract colors from disliked outfit
2. Add to dislikedColors array
3. Decrement style preference
4. Avoid similar combinations in future

// Seasonal adaptation:
1. Detect current season based on date and hemisphere
2. Retrieve seasonal preferences
3. Weight recommendations toward seasonal items
```

## API Reference

### `saveRecommendation(userId, recommendation)`
Saves a recommendation to Firestore history.

**Parameters**:
- `userId` (string): Firebase Auth UID
- `recommendation` (object): Recommendation data without id/userId/createdAt

**Returns**: `Promise<string>` - Recommendation document ID

**Example**:
```typescript
const recId = await saveRecommendation(user.uid, {
  occasion: "casual brunch",
  season: "summer",
  recommendations: { outfit1, outfit2, outfit3 },
  // ...
});
```

### `submitRecommendationFeedback(recommendationId, userId, feedback)`
Records user feedback and updates preferences.

**Parameters**:
- `recommendationId` (string): Document ID from saveRecommendation
- `userId` (string): Firebase Auth UID
- `feedback` (object): User feedback data

**Returns**: `Promise<void>`

**Example**:
```typescript
await submitRecommendationFeedback(recId, user.uid, {
  liked: ['outfit1'],
  disliked: ['outfit2'],
  rating: 5,
  worn: true,
  notes: "Loved the color combination!"
});
```

### `getPersonalizationContext(userId, occasion?)`
Gets aggregated personalization data for AI.

**Parameters**:
- `userId` (string): Firebase Auth UID
- `occasion` (string, optional): Current occasion

**Returns**: `Promise<{ preferences, season, occasionPrefs }>`

**Example**:
```typescript
const context = await getPersonalizationContext(user.uid, "wedding");
// Use context.preferences.favoriteColors in AI prompt
```

## Performance Considerations

### Firestore Reads/Writes
- **Per Recommendation**: 3 writes (recommendation + 2 preference updates)
- **Per Feedback**: 2 writes (feedback + preference update)
- **Per AI Analysis**: 1 read (get user preferences)

### Optimization Strategies
- Use Firestore subcollections for large datasets
- Implement caching for frequently accessed preferences
- Batch update operations where possible
- Use Firestore indexes for efficient queries

### Estimated Costs (per 1000 users/month)
- Recommendations: ~$0.01 (assuming 10 recommendations per user)
- Feedback: ~$0.02 (assuming 20 feedback submissions per user)
- Total: **~$0.03 per 1000 users/month** (minimal)

## Testing Checklist

### ✅ Completed Tests
- [x] Recommendation saves to Firestore
- [x] Feedback buttons render correctly
- [x] Like/dislike feedback submits successfully
- [x] Toast notifications appear
- [x] Detailed feedback dialog opens
- [x] Rating system works
- [x] "Wore it" toggle functions
- [x] Notes field saves

### ⏳ Pending Tests
- [ ] User preferences update correctly from feedback
- [ ] AI recommendations use preference data
- [ ] Seasonal preferences work across hemispheres
- [ ] Occasion memory retrieves relevant outfits
- [ ] Style evolution tracking calculates correctly
- [ ] Wardrobe gap analysis accurate

## Future Enhancements

### Short Term (1-2 weeks)
- [ ] AI flow integration with preferences
- [ ] Preference dashboard for users to view/edit
- [ ] Email notifications for wardrobe gap suggestions

### Medium Term (1 month)
- [ ] Machine learning model for style prediction
- [ ] Collaborative filtering (similar users' preferences)
- [ ] A/B testing for recommendation algorithms

### Long Term (3+ months)
- [ ] Computer vision for wardrobe item detection
- [ ] Virtual try-on with generated outfit images
- [ ] Social features (share outfits, get peer feedback)
- [ ] Integration with fashion brands for exclusive deals

## Troubleshooting

### Common Issues

#### Feedback not saving
- Check Firebase Firestore rules allow writes
- Verify user is authenticated
- Check browser console for errors

#### Preferences not updating
- Ensure `updatePreferencesFromFeedback()` is called
- Verify Firestore document exists
- Check for type mismatches in data

#### Seasonal preferences wrong
- Verify system timezone is correct
- Check hemisphere detection logic
- Ensure months are 0-indexed

## Contributors
- SmartStyle Development Team

## Last Updated
January 2025

## Version
1.0.0 - Initial Implementation
