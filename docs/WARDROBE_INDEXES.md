# Firestore Indexes for Wardrobe Component

## Required Composite Indexes

The Wardrobe component uses the following Firestore queries that require composite indexes:

### 1. Wardrobe Items Query (with filters)

**Collection**: `users/{userId}/wardrobeItems`

**Fields**:
- `isActive` (Ascending)
- `itemType` (Ascending)
- `addedDate` (Descending)

**Query Usage**: Used when filtering wardrobe items by type while maintaining active status and sort order.

```bash
# Firebase CLI command to create index
firebase firestore:indexes:create --collection-group wardrobeItems --query-scope COLLECTION --fields isActive,ASCENDING itemType,ASCENDING addedDate,DESCENDING
```

### 2. Wardrobe Items by Active Status and Date

**Collection**: `users/{userId}/wardrobeItems`

**Fields**:
- `isActive` (Ascending)
- `addedDate` (Descending)

**Query Usage**: Default query for fetching all active wardrobe items sorted by most recent.

```bash
# Firebase CLI command
firebase firestore:indexes:create --collection-group wardrobeItems --query-scope COLLECTION --fields isActive,ASCENDING addedDate,DESCENDING
```

### 3. Wardrobe Outfits by Creation Date

**Collection**: `users/{userId}/wardrobeOutfits`

**Fields**:
- `createdDate` (Descending)

**Query Usage**: Fetch saved outfit combinations sorted by most recent.

```bash
# Firebase CLI command
firebase firestore:indexes:create --collection-group wardrobeOutfits --query-scope COLLECTION --fields createdDate,DESCENDING
```

## Index Configuration File

Add these indexes to your `firestore.indexes.json`:

```json
{
  "indexes": [
    {
      "collectionGroup": "wardrobeItems",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "isActive", "order": "ASCENDING" },
        { "fieldPath": "addedDate", "order": "DESCENDING" }
      ]
    },
    {
      "collectionGroup": "wardrobeItems",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "isActive", "order": "ASCENDING" },
        { "fieldPath": "itemType", "order": "ASCENDING" },
        { "fieldPath": "addedDate", "order": "DESCENDING" }
      ]
    },
    {
      "collectionGroup": "wardrobeOutfits",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "createdDate", "order": "DESCENDING" }
      ]
    }
  ],
  "fieldOverrides": []
}
```

## Deployment

Deploy indexes using Firebase CLI:

```bash
firebase deploy --only firestore:indexes
```

## Automatic Index Creation

When you first run queries that need indexes, Firebase will provide error messages with links to automatically create the required indexes in the Firebase Console. Click those links to create indexes automatically.

## Performance Notes

- **Wardrobe Items Query**: Optimized for fast retrieval with filtering and sorting
- **Composite Indexes**: Required for queries that filter on multiple fields
- **Index Size**: Wardrobe items indexes are small (typically < 100 items per user)
- **Query Cost**: Read operations are efficient with proper indexing

## Testing Indexes

After deployment, test with:

```typescript
// This should work without errors after indexes are deployed
const items = await getWardrobeItems(userId, { itemType: 'top' });
```

## Monitoring

Monitor index usage in Firebase Console:
1. Go to Firestore → Indexes
2. Check "Single-field" and "Composite" tabs
3. Monitor index build status and errors
