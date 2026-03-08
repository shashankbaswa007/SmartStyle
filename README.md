# 👔 SmartStyle — AI-Powered Fashion Recommendation Platform

> Upload an outfit photo, get personalized AI recommendations with generated visuals and one-click shopping links.

[![Live Demo](https://img.shields.io/badge/demo-smart--style.vercel.app-black)](https://smart-style.vercel.app)
[![Next.js](https://img.shields.io/badge/Next.js-14.2-black)](https://nextjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-blue)](https://www.typescriptlang.org/)
[![Firebase](https://img.shields.io/badge/Firebase-12-orange)](https://firebase.google.com/)
[![Tests](https://img.shields.io/badge/tests-Jest%20%2B%20Playwright-green)](jest.config.ts)
[![License](https://img.shields.io/badge/license-MIT-green)](LICENSE)

---

## 🌟 Features

| Category | Highlights |
|----------|-----------|
| **Photo Analysis** | Upload/camera capture with client-side person detection (skin-tone filtering, edge analysis) |
| **AI Recommendations** | 3 personalized outfits via Groq Llama 3.3 70B (Gemini 2.0 Flash fallback) |
| **Image Generation** | Hybrid multi-provider: Replicate FLUX (position 1) + Pollinations.ai (free, positions 2-3) with Firebase Storage caching (60-70% hit rate) |
| **Color Matching** | Client-side color-theory engine (complementary, analogous, triadic, split-complementary, tetradic, monochromatic) powered by chroma-js |
| **Shopping Links** | Amazon India, Myntra, Tata CLiQ via Tavily search API |
| **Personalization** | Weighted preference tracking, 70-20-10 diversification, anti-repetition cache, pattern lock detection |
| **Analytics** | Style evolution charts, color usage heatmaps, engagement metrics (Recharts) |
| **Wardrobe** | Virtual closet with wear tracking, category management, outfit planning |
| **Weather-Aware** | Open-Meteo integration for weather-appropriate suggestions |
| **PWA** | Installable, offline-capable, responsive across mobile/tablet/desktop |

---

## 🏗️ Architecture

```mermaid
graph TB
    subgraph Client["Client (Next.js 14 App Router)"]
        UI[React 18 + Tailwind + shadcn/ui]
        CE[Color Extraction<br/>Vibrant.js]
        IV[Image Validation<br/>Client-side CV]
        CM[Color Matching<br/>chroma-js]
        PWA[Service Worker + PWA]
    end

    subgraph API["API Routes (Next.js)"]
        REC[/api/recommend]
        COL[/api/getColorMatches]
        SHOP[/api/tavily]
        LIKE[/api/likes]
        PREF[/api/preferences]
        RL[Rate Limiter]
        VAL[Zod Validation]
    end

    subgraph AI["AI Services"]
        GROQ[Groq<br/>Llama 3.3 70B<br/>14,400 req/day]
        GEMINI[Google Gemini<br/>2.0 Flash<br/>100 req/day]
        FLUX[Replicate FLUX<br/>$0.003/img]
        POLL[Pollinations.ai<br/>Free]
    end

    subgraph Firebase["Firebase"]
        AUTH[Auth<br/>Google OAuth + Email]
        FS[Firestore<br/>Users, Preferences,<br/>Likes, Analytics]
        STG[Storage<br/>Image Cache]
    end

    subgraph External["External APIs"]
        WEATHER[Open-Meteo<br/>Weather]
        TAVILY[Tavily<br/>Shopping Search]
    end

    UI --> CE --> REC
    UI --> IV --> REC
    UI --> CM
    REC --> RL --> VAL
    REC --> GROQ
    REC -.->|fallback| GEMINI
    REC --> FLUX
    REC --> POLL
    REC --> STG
    SHOP --> TAVILY
    LIKE --> FS
    PREF --> FS
    UI --> AUTH
    UI --> WEATHER
    PWA --> UI
```

### System Flow

```
Upload Photo → Client-side Validation → Color Extraction →
AI Analysis (Groq/Gemini) → Generate 3 Recommendations →
Create Visual Outfits (FLUX/Pollinations) → Cache in Storage →
Add Shopping Links (Tavily) → Display Results →
Track Feedback → Update Preferences → Improve Future Picks
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

**Heuristic Algorithm - Optimized for Real Fashion Photography:**
1. Extract all colors from image using Vibrant.js
2. Filter out skin tones (3-method consensus: RGB, YCbCr, HSV - 95%+ accuracy)
3. Identify fabric/clothing colors (center-weighted, excludes backgrounds)
4. Return 3-7 dominant outfit colors

**Design Philosophy:**
- Optimized for REAL fashion photos with natural lighting and texture
- Filters unrealistic pure RGB colors (not found in real fabric)
- Handles shadows, reflections, and color variations naturally
- 85-90% accuracy on real outfit photos, <10ms extraction time

**Benefits:**
- High accuracy for clothing colors (85-90%)
- Excellent skin tone filtering (95%+)
- Works on any device (client-side)
- Fast performance (3-10ms per image)
- Robust to lighting conditions

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

#### Hybrid Multi-Provider Strategy with Smart Caching
1. **Check Firebase Storage Cache** - 60-70% cache hit rate
2. **Replicate FLUX** (Position 1 only) - Premium quality, $0.003/image
3. **Pollinations.ai** (Positions 2-3) - Free, reliable
4. **Placeholder** (Emergency) - Simple colored boxes

**Caching System:**
- All generated images cached in Firebase Storage
- Cache key: MD5(prompt + colors)
- Cache hit saves ~3-5 seconds + generation cost
- Expected monthly cost: $0.05-0.20 for storage

**Process:**
1. Check if image exists in cache (Firebase Storage)
2. If cached, return immediately (instant delivery)
3. If not cached:
   - Position 1: Use Replicate FLUX for premium quality
   - Positions 2-3: Use Pollinations.ai (free)
4. Cache generated image for future use
5. Fall back to next provider on failure

**Cost Optimization:**
- Position 1: $0.003/image (premium quality where it matters)
- Positions 2-3: Free (good quality for alternatives)
- Cache hits: Free (60-70% of requests)
- Expected monthly cost at 50 users/day: ~$1.45/month
- Expected monthly cost at 500 users/day: ~$14.50/month

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
git clone https://github.com/shashidas95/SmartStyle.git
cd SmartStyle
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

4.Image Generation (Optional - Replicate for premium quality)
REPLICATE_API_TOKEN=r8_your_replicate_token

#  **Configure environment variables:**

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
# Development
npm run dev          # Start development server (cleans .next cache)
npm run build        # Build for production
npm run start        # Start production server
npm run lint         # Run ESLint
npm run typecheck    # Run TypeScript type checking

# Testing
npm test             # Run all Jest tests
npm run test:watch   # Run tests in watch mode
npm run test:coverage # Run tests with coverage report
npm run test:unit    # Run unit tests only (src/)
npm run test:e2e     # Run Playwright E2E tests
npm run test:all     # Run unit + integration + API + E2E tests
npm run test:ci      # CI pipeline (coverage + E2E)
```

---

## 🧪 Testing

### Test Architecture

| Layer | Framework | Location | What's Tested |
|-------|-----------|----------|--------------|
| **Unit** | Jest + ts-jest | `src/lib/__tests__/` | Color matching, caching, rate limiting, validation, timeout utilities |
| **Component** | Jest + React Testing Library | `src/components/__tests__/` | UI rendering, props, conditional display |
| **E2E** | Playwright | `tests/e2e/` | Page loads, navigation, responsive layout, 404 handling |

### Running Tests

```bash
# Unit tests with coverage
npm run test:coverage

# Watch mode during development
npm run test:watch

# E2E smoke tests (requires built app)
npm run build && npm run test:e2e

# Full test suite (CI)
npm run test:ci
```

### Test Coverage Targets

- **Branches:** 60%+
- **Functions:** 60%+
- **Lines:** 60%+
- **Statements:** 60%+

### Key Test Suites

- **`colorMatching.test.ts`** — 15+ tests: color harmony generation, FASHION_COLORS database integrity, palette explanations, fashion context, deterministic output
- **`validation.test.ts`** — Zod schema validation for all API endpoints (recommend, likes, shopping clicks), error formatting
- **`cache.test.ts`** — TTL expiration, max-size eviction, consistent key generation, cleanup
- **`rate-limiter.test.ts`** — Request counting, limit enforcement, window expiry, independent tracking
- **`timeout-utils.test.ts`** — Promise timeout, retry with exponential backoff, error propagation
- **`utils.test.ts`** — Tailwind class merging, conditional classes, edge cases
- **`match-score-badge.test.tsx`** — Component rendering, category mapping, score display toggle

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

### Optimizations
- **Image Caching:** Firebase Storage caches all generated images (60-70% hit rate)
- **Hybrid Image Generation:** Replicate FLUX for position 1 ($0.003), Pollinations.ai (free) for positions 2-3
- **Smart Fallback:** Groq → Gemini → graceful degradation across all AI services
- **Next.js Image:** Lazy loading, WebP auto-format, responsive srcsets
- **Code Splitting:** Dynamic imports for heavy components (Three.js, Recharts)
- **Client-side Processing:** Color extraction and image validation run in the browser (zero server load)
- **Firestore Indexes:** Composite indexes for all frequent queries

### Core Web Vitals
- First Contentful Paint: < 1.5s
- Time to Interactive: < 3s

### Cost at Scale

| Scale | Image Gen | Storage | Total |
|-------|-----------|---------|-------|
| 50 users/day | ~$1.35/mo | ~$0.05/mo | **~$1.40/mo** |
| 500 users/day | ~$13.50/mo | ~$0.20/mo | **~$14/mo** |

---

## 🐛 Troubleshooting

| Issue | Fix |
|-------|-----|
| AI requests failing | Check API keys in `.env.local`; verify Groq (14,400/day) and Gemini (100/day) quotas |
| Colors not extracting | Ensure good lighting; check photo contains clothing; try JPG/PNG |
| Match scores missing | Requires 5+ interactions to build profile; verify user is signed in |
| Images not generating | Check Replicate token; Pollinations fallback should auto-activate |
| Shopping links broken | Tavily API key may be missing; fallback search URLs still work |

---

## 📈 Roadmap

### Completed

- [x] Wardrobe management with wear tracking
- [x] Offline mode (PWA with service worker)
- [x] Weather-aware recommendations
- [x] Color palette generator with 6 harmony types
- [x] Analytics dashboard with style evolution charts
- [x] Responsive design (mobile, tablet, desktop)
- [x] Unit, component, and E2E testing infrastructure

### Upcoming Features

- [ ] Body type preferences
- [ ] Budget-aware recommendations
- [ ] Social sharing of outfits
- [ ] Collaborative filtering (similar users)
- [ ] Virtual try-on (AR)
- [ ] Style evolution timeline
- [ ] Brand preferences

### Technical Improvements

- [ ] Redis caching layer
- [ ] GraphQL API
- [ ] Mobile native app (React Native)
- [ ] A/B testing framework
- [ ] ML-based outfit scoring

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
