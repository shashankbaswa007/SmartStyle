# Integration Guide: Making Your Components Smooth

This guide shows how to enhance existing SmartStyle components with the new smooth UI features.

## Quick Start

### 1. Import Smooth UI Components

```typescript
// Instead of regular components, import enhanced versions
import {
  AnimatedButton,
  EnhancedLikeButton,
  EnhancedOutfitCard,
  OutfitCardGrid,
  OutfitSkeletonGridEnhanced,
  SwipeableCard,
  ZoomableImage,
  useHapticFeedback,
  useOptimisticUpdate,
} from '@/components/smooth-ui';
```

## Example Integrations

### Example 1: Enhance Existing Button

**Before:**
```tsx
<Button onClick={handleSubmit} disabled={loading}>
  {loading ? 'Uploading...' : 'Upload Outfit'}
</Button>
```

**After:**
```tsx
<AnimatedButton
  onClick={handleSubmit}
  loading={loading}
  loadingText="Uploading..."
  haptic
  hapticPattern="medium"
>
  Upload Outfit
</AnimatedButton>
```

**Benefits:**
- ✅ Instant tap feedback (scale animation)
- ✅ Haptic vibration on mobile
- ✅ Smooth loading state transition
- ✅ GPU-accelerated animations

---

### Example 2: Add Skeleton Loaders

**Before:**
```tsx
{isGenerating && <div className="text-center">Loading...</div>}
{recommendations && <div className="grid">{/* outfit cards */}</div>}
```

**After:**
```tsx
{isGenerating && <OutfitSkeletonGridEnhanced count={3} />}
{recommendations && (
  <OutfitCardGrid>
    {recommendations.map((outfit, i) => (
      <EnhancedOutfitCard
        key={i}
        delay={i * 0.1}
        imageUrl={outfit.imageUrl}
      >
        {/* outfit content */}
      </EnhancedOutfitCard>
    ))}
  </OutfitCardGrid>
)}
```

**Benefits:**
- ✅ Zero layout shift (skeleton has exact dimensions)
- ✅ Smooth stagger animation when cards appear
- ✅ Card lift effect on hover
- ✅ Image zoom inside cards

---

### Example 3: Enhanced Like Button with Optimistic Updates

**Before:**
```tsx
const [liked, setLiked] = useState(false);

const handleLike = async () => {
  setLiked(true);
  await saveLikedOutfit(outfitId);
};

return (
  <button onClick={handleLike}>
    <Heart className={liked ? 'fill-red-500' : ''} />
  </button>
);
```

**After:**
```tsx
const handleLike = async () => {
  await saveLikedOutfit(outfitId);
  return true; // Return new liked state
};

return (
  <EnhancedLikeButton
    isLiked={outfit.isLiked}
    onToggle={handleLike}
    likeCount={outfit.likeCount}
    showCount
  />
);
```

**Benefits:**
- ✅ Instant UI update (optimistic)
- ✅ Heart bounce animation
- ✅ Particle burst effect
- ✅ Haptic success feedback
- ✅ Automatic rollback on error
- ✅ Count-up animation

---

### Example 4: Make Images Zoomable

**Before:**
```tsx
<Image
  src={outfit.imageUrl}
  alt={outfit.title}
  width={400}
  height={500}
  className="rounded-lg"
/>
```

**After:**
```tsx
<ZoomableImage
  src={outfit.imageUrl}
  alt={outfit.title}
  width={400}
  height={500}
  enableFullscreen
/>
```

**Benefits:**
- ✅ Click to open fullscreen view
- ✅ Pinch-to-zoom support
- ✅ Zoom controls (zoom in/out/reset)
- ✅ Smooth animations
- ✅ Swipe to close

---

### Example 5: Add Swipe Gestures to Cards

**Before:**
```tsx
<div className="outfit-card">
  <OutfitImage />
  <OutfitDetails />
  <div className="actions">
    <button onClick={handleLike}>Like</button>
    <button onClick={handleDislike}>Pass</button>
  </div>
</div>
```

**After:**
```tsx
<SwipeableCard
  onSwipeLeft={handleDislike}
  onSwipeRight={handleLike}
  threshold={100}
>
  <OutfitImage />
  <OutfitDetails />
</SwipeableCard>
```

**Benefits:**
- ✅ Native app-like swipe gestures
- ✅ Visual indicators slide in during swipe
- ✅ Haptic feedback at threshold
- ✅ Natural card rotation
- ✅ Smooth animations

---

### Example 6: Virtual Scrolling for Long Lists

**Before:**
```tsx
<div className="likes-list">
  {likedOutfits.map(outfit => (
    <OutfitCard key={outfit.id} {...outfit} />
  ))}
</div>
```

**After:**
```tsx
import { VirtualizedList } from '@/components/smooth-ui';

<VirtualizedList
  items={likedOutfits}
  itemHeight={450}
  height={window.innerHeight - 100}
  renderItem={(outfit) => (
    <OutfitCard {...outfit} />
  )}
  overscanCount={3}
/>
```

**Benefits:**
- ✅ Only renders visible items
- ✅ Smooth 60fps scrolling even with 1000+ items
- ✅ Reduced memory usage
- ✅ Fast initial render

---

### Example 7: Pull-to-Refresh

**Before:**
```tsx
<div className="page">
  <button onClick={refreshData}>Refresh</button>
  {/* content */}
</div>
```

**After:**
```tsx
import { PullToRefresh } from '@/components/smooth-ui';

<PullToRefresh onRefresh={refreshData}>
  {/* content */}
</PullToRefresh>
```

**Benefits:**
- ✅ Native pull-to-refresh gesture
- ✅ Rubber band physics
- ✅ Loading indicator animation
- ✅ Haptic feedback
- ✅ Feels like native app

---

### Example 8: Page Transitions

**Before:**
```tsx
// In page component
export default function AnalyticsPage() {
  return <div>{/* content */}</div>;
}
```

**After:**
```tsx
import { PageTransition } from '@/components/smooth-ui';

export default function AnalyticsPage() {
  return (
    <PageTransition>
      <div>{/* content */}</div>
    </PageTransition>
  );
}
```

**Benefits:**
- ✅ Smooth fade + slide transitions between pages
- ✅ Exit animations when leaving page
- ✅ Consistent feel across navigation

---

### Example 9: Scroll-Triggered Animations

**Before:**
```tsx
<div className="analytics-section">
  <StatsCards />
  <Charts />
</div>
```

**After:**
```tsx
import { ScrollReveal } from '@/components/smooth-ui';

<div className="analytics-section">
  <ScrollReveal delay={0}>
    <StatsCards />
  </ScrollReveal>
  <ScrollReveal delay={0.2}>
    <Charts />
  </ScrollReveal>
</div>
```

**Benefits:**
- ✅ Elements animate in when scrolled into view
- ✅ Stagger delay for multiple elements
- ✅ Only animates once (triggerOnce)
- ✅ Smooth fade + slide animation

---

### Example 10: Toast Notifications

**Before:**
```tsx
import { useToast } from '@/hooks/use-toast';

const { toast } = useToast();
toast({ title: 'Success!', description: 'Outfit saved' });
```

**After:**
```tsx
import { useAnimatedToast } from '@/components/smooth-ui';

const { showToast, ToastContainer } = useAnimatedToast();

// Show toast
showToast({
  message: 'Outfit saved successfully!',
  type: 'success',
  duration: 3000,
});

// Render container
<ToastContainer />
```

**Benefits:**
- ✅ Smooth slide animation from top
- ✅ Bounce effect on entry
- ✅ Success/error/info/loading types
- ✅ Auto-dismiss with timer
- ✅ Manual close button

---

## Advanced Usage

### Using Color Worker for Performance

**Before:**
```tsx
// Color extraction blocks main thread
const extractColors = (image) => {
  // Heavy computation on main thread
  // UI feels janky during this
};
```

**After:**
```tsx
import { useColorWorker } from '@/hooks/useColorWorker';

const { extractColors } = useColorWorker();

// Color extraction happens in background
const colors = await extractColors(imageData, {
  maxColors: 5,
  quality: 10
});
// UI stays smooth at 60fps
```

---

### Using Optimistic Updates

```tsx
import { useOptimisticUpdate } from '@/hooks/useOptimisticUpdate';

const { value: isLiked, update } = useOptimisticUpdate(false);

const handleLike = async () => {
  // UI updates immediately to true
  // If API fails, rolls back to false
  await update(true, async () => {
    const result = await saveLikeToAPI();
    return result.liked;
  });
};
```

---

### Using Haptic Feedback

```tsx
import { useHapticFeedback } from '@/hooks/useHapticFeedback';

const { triggerHaptic } = useHapticFeedback();

const handleAction = () => {
  triggerHaptic('success'); // Double tap vibration
  // ... rest of logic
};

// Available patterns:
// 'light' - 10ms
// 'medium' - 30ms
// 'heavy' - 50ms
// 'success' - double tap pattern
// 'error' - strong double pulse
```

---

## Performance Tips

### 1. Use React.memo for Expensive Components

```tsx
const OutfitCard = React.memo(({ outfit }) => {
  // Component only re-renders when outfit prop changes
  return <div>...</div>;
});
```

### 2. Use CSS Containment

```tsx
<div className="contain-layout-paint">
  {/* Complex component isolated from rest of page */}
</div>
```

### 3. Lazy Load Heavy Components

```tsx
const AnalyticsCharts = lazy(() => import('./AnalyticsCharts'));

<Suspense fallback={<ChartSkeleton />}>
  <AnalyticsCharts />
</Suspense>
```

### 4. Preload Critical Resources

```tsx
import { useEffect } from 'react';

useEffect(() => {
  // Preload next likely page
  const link = document.createElement('link');
  link.rel = 'prefetch';
  link.href = '/analytics';
  document.head.appendChild(link);
}, []);
```

---

## Checklist: Is Your Component Smooth?

- [ ] Shows skeleton loader immediately when loading
- [ ] All images have explicit aspect ratios
- [ ] Buttons provide instant feedback (scale animation)
- [ ] Uses GPU-accelerated animations (transform & opacity only)
- [ ] Long lists use virtualization (50+ items)
- [ ] Heavy computations moved to Web Workers
- [ ] Optimistic updates for better perceived performance
- [ ] Mobile gestures implemented (swipe, pull-to-refresh)
- [ ] Haptic feedback on key interactions
- [ ] Smooth page transitions
- [ ] No layout shifts (CLS = 0)
- [ ] Consistent 60fps during animations

---

## Migration Strategy

### Phase 1: Quick Wins (1-2 hours)
1. Replace buttons with AnimatedButton
2. Add skeleton loaders before content loads
3. Update global CSS (already done)

### Phase 2: Enhanced Interactions (2-3 hours)
4. Replace like buttons with EnhancedLikeButton
5. Add swipe gestures to outfit cards
6. Implement pull-to-refresh on main pages

### Phase 3: Performance (2-3 hours)
7. Add virtual scrolling to long lists
8. Move color extraction to Web Worker
9. Add React.memo to expensive components

### Phase 4: Polish (1-2 hours)
10. Add page transitions
11. Implement scroll-triggered animations
12. Add pinch-to-zoom to images

---

## Need Help?

Check the comprehensive documentation: `/docs/SMOOTH_UI_ENHANCEMENTS.md`

Common issues and solutions are listed in the Troubleshooting section.
