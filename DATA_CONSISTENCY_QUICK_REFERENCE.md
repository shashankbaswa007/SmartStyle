# Quick Reference: Data Consistency

## Transaction Usage

```typescript
import { 
  likeOutfitTransaction, 
  unlikeOutfitTransaction,
  updatePreferencesTransaction 
} from '@/lib/transactions';

// Like an outfit atomically
await likeOutfitTransaction(userId, outfit, colorWeights);

// Unlike an outfit atomically
await unlikeOutfitTransaction(userId, outfitId, colorWeights);

// Update preferences atomically
await updatePreferencesTransaction(userId, { 
  favoriteColors: ['#FF5733'],
  preferredOccasions: ['casual']
});
```

## Validation Usage

```typescript
import { validateData, safeValidateData } from '@/lib/validation/schemas';
import { outfitSchema, hexColorSchema } from '@/lib/validation/schemas';

// Throw on error
const validatedOutfit = validateData(outfitSchema, userInput);

// Return { success, data } or { success: false, error }
const result = safeValidateData(hexColorSchema, '#FF5733');
if (result.success) {
  console.log('Valid:', result.data); // '#FF5733'
}
```

## Audit Logging

```typescript
import { logAuditEvent, logDeletion, recoverDeletedData } from '@/lib/audit-log';

// Log any action
await logAuditEvent({
  userId: 'user_123',
  action: 'like',
  collection: 'likedOutfits',
  documentId: 'outfit_456',
  newData: outfitData
});

// Log deletion (enables recovery)
const deletionId = await logDeletion(userId, 'likedOutfits', outfitId, data);

// Recover deleted data (within 90 days)
const result = await recoverDeletedData(deletionId);
```

## Cloud Functions

```bash
# Deploy all cleanup functions
cd functions && npm install
npm run deploy

# Deploy specific function
firebase deploy --only functions:cleanupOrphanedImages

# Test locally
npm run serve
```

## Cleanup Schedule

- **Daily 2AM UTC:** Delete orphaned images (>7 days old)
- **Weekly Sunday 3AM:** Archive old recommendations (>6 months)
- **Monthly 1st 4AM:** Archive audit logs (>12 months)
- **Monthly 15th 5AM:** Remove old deleted items (>90 days)

## Key Benefits

✅ **Atomicity:** All-or-nothing operations  
✅ **Validation:** Type-safe data before writes  
✅ **Audit Trail:** Complete change history  
✅ **Data Recovery:** 90-day deletion window  
✅ **Auto Cleanup:** Reduce storage costs
