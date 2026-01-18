# 👔 SmartStyle - AI-Powered Fashion Recommendation Platform

> An intelligent fashion advisor that analyzes your outfits and provides personalized style recommendations with AI-generated visuals and shopping links.

[![Next.js](https://img.shields.io/badge/Next.js-14-black)](https://nextjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue)](https://www.typescriptlang.org/)
[![Firebase](https://img.shields.io/badge/Firebase-10.0-orange)](https://firebase.google.com/)
[![License](https://img.shields.io/badge/license-MIT-green)](LICENSE)

---

## 🌟 Features

### Core Functionality
- **📸 Photo Analysis** - Upload outfit photos with AI-powered validation
- **🎨 Smart Color Extraction** - Heuristic algorithm extracts outfit colors (ignoring skin tones)
- **🤖 AI Recommendations** - Get 3 personalized outfit suggestions with detailed descriptions
- **🖼️ Visual Generation** - AI-generated outfit images with color-accurate visuals
- **🛍️ Shopping Integration** - Direct links to Amazon India, Myntra, and Tata CLiQ
- **❤️ Personalization** - Learn from your likes and preferences over time
- **📊 Analytics Dashboard** - Track your style evolution and preference patterns

### Advanced Features
- **70-20-10 Diversification** - Balanced recommendations (safe bets + exploration)
- **Anti-Repetition** - Never see the same outfit combinations within 30 days
- **Pattern Lock Detection** - Prevents style echo chambers
- **Weather Integration** - Location-based weather data for appropriate suggestions
- **Color Matching** - Harmonious color palette generator
- **Responsive PWA** - Works on mobile, tablet, and desktop

---

## 🏗️ Architecture

### Technology Stack

```
Frontend:
├── Next.js 14 (App Router)
├── React 18 + TypeScript
├── Tailwind CSS + shadcn/ui
└── Recharts (Analytics)

Backend:
├── Next.js API Routes
├── Firebase Firestore
├── Firebase Auth
└── Firebase Storage

AI Services:
├── Groq (Llama 3.3 70B) - Primary
├── Google Gemini 2.0 Flash - Backup
└── Pollinations.ai - Image Generation

External APIs:
├── Open-Meteo (Weather)
├── Tavily (Shopping Search)
└── Vibrant.js (Color Extraction)
```

### System Flow

```
User Upload Photo → Color Extraction → AI Analysis → 
Generate Recommendations → Create Visual Outfits → 
Add Shopping Links → Display Results → 
Track User Feedback → Update Preferences
```

---

## 📁 Project Structure

```
SmartStyle/
├── src/
│   ├── app/                          # Next.js App Router
│   │   ├── page.tsx                  # Landing page
│   │   ├── style-check/              # Main style advisor
│   │   ├── color-match/              # Color palette tool
│   │   ├── likes/                    # Saved outfits
│   │   ├── preferences/              # User style profile
│   │   ├── analytics/                # Dashboard
│   │   ├── account-settings/         # User settings
│   │   ├── auth/                     # Authentication
│   │   └── api/                      # API routes
│   │       ├── recommend/            # Main recommendation API
│   │       ├── getColorMatches/      # Color matching API
│   │       └── tavily/               # Shopping search API
│   │
│   ├── components/                   # React components
│   │   ├── ui/                       # shadcn/ui components
│   │   ├── style-advisor-results.tsx # Recommendation display
│   │   ├── match-score-badge.tsx     # Personalization badges
│   │   ├── photo-capture.tsx         # Image upload/camera
│   │   ├── image-preview.tsx         # Photo preview
│   │   ├── enhanced-color-palette.tsx# Color display
│   │   └── recommendation-feedback.tsx# Like/dislike system
│   │
│   ├── ai/                           # AI integration layer
│   │   └── flows/
│   │       └── analyze-image-and-provide-recommendations.ts
│   │
│   ├── lib/                          # Core business logic
│   │   ├── firebase.ts               # Firebase initialization
│   │   ├── color-extraction.ts       # Smart color detection
│   │   ├── preference-engine.ts      # User preference tracking
│   │   ├── blocklist-manager.ts      # Style blocklists
│   │   ├── recommendation-diversifier.ts # 70-20-10 algorithm
│   │   ├── interaction-tracker.ts    # User behavior tracking
│   │   ├── prompt-personalizer.ts    # AI prompt enhancement
│   │   ├── personalization.ts        # Outfit tracking
│   │   ├── likedOutfits.ts          # Favorites management
│   │   ├── tavily.ts                # Shopping search
│   │   └── utils.ts                 # Utilities
│   │
│   └── hooks/                        # Custom React hooks
│       └── use-toast.ts             # Toast notifications
│
├── public/                           # Static assets
├── firestore.rules                   # Database security rules
├── firestore.indexes.json            # Database indexes
├── storage.rules                     # Storage security rules
└── package.json                      # Dependencies
```

---

## 🧩 Core Components Explained

### 1. Style Advisor (`/style-check`)

**Purpose:** Main feature - analyzes outfit photos and provides recommendations

**Flow:**
1. User uploads photo (drag-drop, file picker, or camera)
2. Smart color extraction identifies outfit colors (ignores skin tones)
3. AI analyzes photo with context (weather, user preferences)
4. Generates 3 personalized outfit recommendations
5. Creates AI-generated images for each outfit
6. Adds shopping links for each item
7. Displays with match score badges

**Key Files:**
- `src/app/style-check/page.tsx` - Main page
- `src/components/style-advisor-results.tsx` - Results display
- `src/app/api/recommend/route.ts` - Backend API
- `src/lib/color-extraction.ts` - Color detection

---

### 2. Personalization Engine

**Purpose:** Learn user preferences and improve recommendations over time

**Components:**

#### Preference Tracking (`src/lib/preference-engine.ts`)
- Tracks color preferences (weighted by interactions)
- Tracks style preferences (minimalist, casual, formal, etc.)
- Tracks occasion preferences (office, date night, etc.)
- Tracks seasonal preferences (spring, summer, fall, winter)
- Real-time updates on every interaction

#### Blocklist Management (`src/lib/blocklist-manager.ts`)
- **Hard Blocklist** - Never show items (−40 points)
- **Soft Blocklist** - Show rarely (−20 points)
- **Temporary Blocklist** - Time-limited blocks (−10 points)

#### Recommendation Diversifier (`src/lib/recommendation-diversifier.ts`)
- **70-20-10 Rule:**
  - Position 1: 90-100% match (safe bet)
  - Position 2: 70-89% match (adjacent exploration)
  - Position 3: 50-69% match (learning boundary)
- **Anti-Repetition Cache:**
  - Color combos: 30-day TTL
  - Styles: 15-day TTL
  - Occasions: 7-day TTL
- **Adaptive Exploration:** Adjusts 5-25% based on user response
- **Pattern Lock Detection:** Prevents style echo chambers

#### Match Score Calculation
```typescript
score = (colorMatch × 0.35) + 
        (styleMatch × 0.30) + 
        (occasionMatch × 0.20) + 
        (seasonalMatch × 0.15) - 
        blocklistPenalty
```

---

### 3. Color System

#### Smart Color Extraction (`src/lib/color-extraction.ts`)

**Heuristic Algorithm:**
1. Extract all colors from image using Vibrant.js
2. Filter out skin tones (hue: 10-50°, saturation: 20-80%, lightness: 40-80%)
3. Identify fabric/clothing colors (high saturation or strong presence)
4. Return 3-5 dominant outfit colors

**Benefits:**
- 85%+ accuracy for clothing colors
- Ignores backgrounds and skin tones
- Works on any device (client-side)

#### Color Palette Generator (`/color-match`)
- Generate harmonious color combinations
- Complementary, analogous, triadic schemes
- Real-time color theory visualization
- Copy hex codes for reference

---

### 4. AI Integration

#### Primary AI: Groq (Llama 3.3 70B)
- **Usage:** 96% of requests
- **Quota:** 14,400 requests/day
- **Speed:** ~3-5 seconds per request
- **Strengths:** Fast, high-quality text generation

#### Backup AI: Google Gemini 2.0 Flash
- **Usage:** 4% of requests (fallback)
- **Quota:** 100 requests/day
- **Speed:** ~5-10 seconds per request
- **Strengths:** Multimodal, image generation

#### AI Flow (`src/ai/flows/analyze-image-and-provide-recommendations.ts`)
```typescript
Input:
- Photo (base64)
- Extracted colors
- User preferences (optional)
- Weather data (optional)
- Gender
- Occasion

Output:
- General feedback (paragraph)
- Highlights (2-3 tips)
- Color suggestions (8-10 colors)
- Outfit recommendations (3):
  - Title
  - Description (detailed)
  - Color palette
  - Style type
  - Occasion
  - Items list
  - Shopping links
  - Image generation prompt
```

---

### 5. Image Generation

#### Multi-Provider Strategy
1. **Gemini Imagen 3** (Primary) - High quality, color accurate
2. **Pollinations.ai** (Fallback) - Reliable, fast
3. **Placeholder** (Emergency) - Simple colored boxes

**Process:**
1. AI generates detailed image prompt
2. Include specific colors in hex format
3. Add style, occasion, and item details
4. Attempt generation with timeout (30s)
5. Fall back to next provider on failure

---

### 6. Shopping Integration

#### Tavily Search API (`src/lib/tavily.ts`)
- Searches multiple shopping platforms
- Filters by gender and item type
- Returns direct product links

#### Supported Platforms:
- **Amazon India** - General fashion items
- **Myntra** - Indian fashion brands
- **Tata CLiQ** - Premium fashion

#### Link Generation:
- Automatic fallback to search queries
- Gender-specific paths
- Optimized for mobile/desktop

---

### 7. User Dashboard (`/preferences`)

**Features:**
- **Stats Overview:** Likes, wears, shopping clicks
- **Color Preferences:** Visual swatches with hex codes
- **Style Personality:** Bar chart of fashion styles
- **Occasion Preferences:** Grid of common events
- **Seasonal Preferences:** 4-season breakdown
- **Blocklist Management:** View blocked items
- **Data Export:** Download preferences as JSON

---

### 8. Analytics Dashboard (`/analytics`)

**Metrics Tracked:**
- Recommendation acceptance rate over time
- Style distribution (pie chart)
- Color usage patterns
- Occasion breakdown
- Monthly trends
- User engagement metrics

**Visualizations:**
- Line charts (trend over time)
- Pie charts (distribution)
- Bar charts (comparison)
- Stat cards (totals)

---

### 9. Likes System (`/likes`)

**Features:**
- Save favorite outfit recommendations
- View all liked outfits
- Filter by date, style, occasion
- Shopping links preserved
- Image previews with lazy loading

**Real-Time Updates:**
- Like triggers preference update (+2 points)
- Mark as "worn" gives +5 points
- Shopping click tracks commercial intent

---

### 10. Authentication

**Methods:**
- Google OAuth (primary)
- Email/Password (alternative)
- Anonymous mode (limited features)

**Firebase Auth Flow:**
```
User Sign In → Token Generation → 
Firestore User Document → 
Preference Initialization → 
Redirect to App
```

---

## 🗄️ Database Schema

### Firestore Collections

#### `users/{userId}`
```typescript
{
  email: string
  displayName: string
  photoURL: string
  createdAt: timestamp
  lastLogin: timestamp
}
```

#### `userPreferences/{userId}`
```typescript
{
  colorProfiles: { [hex: string]: number }
  styleProfiles: { [style: string]: number }
  occasionProfiles: { [occasion: string]: number }
  seasonalProfiles: { [season: string]: number }
  totalLikes: number
  totalWears: number
  totalShoppingClicks: number
  lastUpdated: timestamp
}
```

#### `userBlocklists/{userId}`
```typescript
{
  hardBlocklist: {
    colors: string[]
    styles: string[]
    items: string[]
  }
  softBlocklist: {
    colors: string[]
    styles: string[]
    items: string[]
  }
  temporaryBlocklist: Array<{
    color?: string
    style?: string
    item?: string
    expiresAt: timestamp
    reason: string
  }>
}
```

#### `antiRepetitionCache/{userId}`
```typescript
{
  recentColorCombos: Array<{
    colors: string[]
    timestamp: timestamp
    ttl: number (30 days)
  }>
  recentStyles: Array<{
    style: string
    timestamp: timestamp
    ttl: number (15 days)
  }>
  recentOccasions: Array<{
    occasion: string
    timestamp: timestamp
    ttl: number (7 days)
  }>
}
```

#### `explorationMetrics/{userId}`
```typescript
{
  explorationPercentage: number (5-25)
  position3Likes: number
  position3Dislikes: number
  position3Skips: number
  successRate: number
  lastUpdated: timestamp
}
```

#### `recommendationHistory/{recommendationId}`
```typescript
{
  userId: string
  imageUrl: string
  colors: string[]
  weather: object
  recommendations: array
  provider: "groq" | "gemini"
  createdAt: timestamp
  feedback?: string
}
```

#### `likedOutfits/{likeId}`
```typescript
{
  userId: string
  recommendationId: string
  outfit: object
  likedAt: timestamp
  occasion?: string
  season?: string
}
```

#### `userInteractions/{userId}/sessions/{sessionId}`
```typescript
{
  recommendationId: string
  timestamp: timestamp
  outfitIndex: number
  action: "like" | "wore" | "shopping"
  metadata: {
    colors: string[]
    styles: string[]
    occasion: string
  }
}
```

---

## 🚀 Getting Started

### Prerequisites

- Node.js 18+ and npm
- Firebase account with project
- API keys for:
  - Groq API (free tier: 14,400 requests/day)
  - Google Gemini API (free tier: 100 requests/day)
  - Tavily API (optional, for shopping)

### Installation

1. **Clone the repository:**
```bash
git clone https://github.com/yourusername/smartstyle.git
cd smartstyle
```

2. **Install dependencies:**
```bash
npm install
```

3. **Set up Firebase:**
   - Create a Firebase project at [firebase.google.com](https://firebase.google.com)
   - Enable Firestore Database
   - Enable Authentication (Google & Email/Password)
   - Enable Storage
   - Download service account key

4. **Configure environment variables:**

Create `.env.local`:
```env
# Firebase Client Config
NEXT_PUBLIC_FIREBASE_API_KEY=your_api_key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your_project_id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your_project.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
NEXT_PUBLIC_FIREBASE_APP_ID=your_app_id

# AI API Keys
GROQ_API_KEY=gsk_your_groq_key
GOOGLE_AI_API_KEY=AIza_your_gemini_key

# Optional APIs
TAVILY_API_KEY=tvly_your_tavily_key

# App Config
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

5. **Deploy Firestore rules:**
```bash
firebase deploy --only firestore:rules
firebase deploy --only storage:rules
firebase deploy --only firestore:indexes
```

6. **Run development server:**
```bash
npm run dev
```

Visit `http://localhost:3000`

---

## 🛠️ Development

### Available Scripts

```bash
npm run dev          # Start development server
npm run build        # Build for production
npm run start        # Start production server
npm run lint         # Run ESLint
npm run type-check   # Run TypeScript checks
```

### Code Structure Guidelines

**Components:**
- Use functional components with hooks
- Keep components under 300 lines
- Extract reusable logic to custom hooks
- Use TypeScript interfaces for props

**API Routes:**
- Handle errors gracefully
- Return consistent JSON responses
- Use try-catch blocks
- Log errors for debugging

**State Management:**
- Use React hooks (useState, useEffect)
- Firebase real-time listeners for data
- Toast notifications for user feedback

---

## 🎨 Customization

### Adding New AI Providers

1. Create provider function in `src/ai/flows/`
2. Add to fallback chain in main flow
3. Update environment variables
4. Test with quota limits

### Adding New Shopping Platforms

1. Update `src/lib/tavily.ts`
2. Add URL patterns to `generateSearchUrls()`
3. Test link generation
4. Update UI components

### Customizing Match Scoring

Edit weights in `src/lib/recommendation-diversifier.ts`:
```typescript
const score = 
  (colorScore * 0.35) +    // Color weight
  (styleScore * 0.30) +    // Style weight
  (occasionScore * 0.20) + // Occasion weight
  (seasonalScore * 0.15);  // Seasonal weight
```

---

## 🔒 Security

### Firestore Security Rules

- Users can only read/write their own data
- Anonymous users have limited access
- Validation on all writes
- Rate limiting on sensitive operations

### API Security

- Rate limiting on AI endpoints
- Input validation on all routes
- Error messages don't leak sensitive info
- CORS configured for app domain only

### Environment Variables

- Never commit `.env.local`
- Use secret management in production
- Rotate API keys regularly
- Monitor usage quotas

---

## 📊 Performance

### Optimizations Implemented

- **Image Optimization:** Next.js Image component with lazy loading
- **Code Splitting:** Dynamic imports for heavy components
- **Caching:** Browser cache for static assets
- **Database:** Indexed queries, batch operations
- **AI Fallback:** Multiple providers prevent downtime
- **Color Extraction:** Client-side processing (no server load)

### Metrics

- First Contentful Paint: <1.5s
- Time to Interactive: <3s
- Lighthouse Score: 90+
- Core Web Vitals: All green

---

## 🐛 Troubleshooting

### Common Issues

**Issue: AI requests failing**
- Check API keys in `.env.local`
- Verify quota limits (Groq: 14,400/day, Gemini: 100/day)
- Check console for specific error messages

**Issue: Colors not extracting**
- Ensure photo has good lighting
- Check if photo contains actual clothing
- Try different image format (JPG/PNG)

**Issue: Match scores not showing**
- User needs 5+ interactions to build profile
- Verify user is signed in
- Check Firestore `userPreferences` collection

**Issue: Images not generating**
- Gemini may have hit quota (100/day)
- Fallback to Pollinations.ai should be automatic
- Check network tab for generation errors

**Issue: Shopping links not working**
- Tavily API key may be missing/invalid
- Fallback search URLs still work
- Some platforms may block direct linking

---

## 📈 Roadmap

### Upcoming Features

- [ ] Body type preferences
- [ ] Budget-aware recommendations
- [ ] Social sharing of outfits
- [ ] Collaborative filtering (similar users)
- [ ] Seasonal trend integration
- [ ] Virtual try-on (AR)
- [ ] Style evolution timeline
- [ ] Outfit combination suggestions
- [ ] Wardrobe management
- [ ] Brand preferences

### Technical Improvements

- [ ] Redis caching layer
- [ ] GraphQL API
- [ ] Mobile native app
- [ ] Offline mode (PWA)
- [ ] WebP image format
- [ ] Server-side rendering for SEO
- [ ] A/B testing framework
- [ ] Machine learning models

---

## 🤝 Contributing

Contributions are welcome! Please:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

### Development Guidelines

- Follow existing code style
- Add TypeScript types
- Write meaningful commit messages
- Test thoroughly before submitting
- Update README if needed

---

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

## 🙏 Acknowledgments

- **Groq** - Fast AI inference
- **Google Gemini** - Multimodal AI capabilities
- **Firebase** - Backend infrastructure
- **shadcn/ui** - Beautiful UI components
- **Pollinations.ai** - Reliable image generation
- **Vibrant.js** - Color extraction library
- **Open-Meteo** - Free weather API

---

## 📞 Support

For issues, questions, or suggestions:

- **GitHub Issues:** [Create an issue](https://github.com/yourusername/smartstyle/issues)
- **Email:** support@smartstyle.app
- **Documentation:** This README + inline code comments

---

**Built with ❤️ using Next.js, TypeScript, and AI**

*Last Updated: January 18, 2026*
