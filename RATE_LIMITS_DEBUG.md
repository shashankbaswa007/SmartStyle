# Usage Limits Debug Guide

## Issue
Usage meters showed 0 remaining tokens even though no API calls were made. This happens when:
1. Stale rate limit records exist in Firestore with old window timestamps
2. Old test/development data persists
3. Window boundary calculations don't match stored timestamps

## Solution

### 1. Check Current Rate Limits (Diagnostic)

Make a GET request with your auth token:

```bash
curl -X GET \
  'http://localhost:3000/api/admin/rate-limits' \
  -H 'Authorization: Bearer YOUR_ID_TOKEN'
```

Response example:
```json
{
  "userId": "user123",
  "rateLimits": {
    "recommend": {
      "exists": true,
      "count": 10,
      "windowStart": "2026-03-24T15:30:00.000Z"
    },
    "wardrobe-outfit": {
      "exists": true,
      "count": 10,
      "windowStart": "2026-03-24T15:30:00.000Z"
    },
    "wardrobe-upload": {
      "exists": true,
      "count": 20,
      "windowStart": "2026-03-24T15:30:00.000Z"
    }
  }
}
```

If `count` shows values like 10, 10, 20 and `windowStart` is old (yesterday or earlier), that's the problem.

### 2. Reset Rate Limits

Make a DELETE request to clear all rate limit records for your user:

```bash
curl -X DELETE \
  'http://localhost:3000/api/admin/rate-limits' \
  -H 'Authorization: Bearer YOUR_ID_TOKEN'
```

Response:
```json
{
  "success": true,
  "message": "Reset rate limits for user user123",
  "scopes": ["recommend", "wardrobe-outfit", "wardrobe-upload"]
}
```

### 3. Verify Reset

Call GET again to confirm the records are gone:

```bash
curl -X GET \
  'http://localhost:3000/api/admin/rate-limits' \
  -H 'Authorization: Bearer YOUR_ID_TOKEN'
```

All scopes should now show `exists: false` and `count: 0`.

### 4. Check Meters

Refresh your app pages. The meters should now show:
- **Style-Check**: 10/10 available today
- **Wardrobe Outfits**: 10/10 available today
- **Wardrobe Uploads**: 20/20 available today

## How to Get Your ID Token

In your browser console (on the app):

```javascript
const idToken = await firebase.auth().currentUser.getIdToken();
console.log(idToken);
```

Or use the auth module in the app to display it temporarily for testing.

## Technical Fixes Applied

1. **Window Reset Logic**: Enhanced `checkServerRateLimit` and `getServerRateLimitStatus` to automatically reset counters when window boundaries change (24+ hours)

2. **Safety Checks**: Added null-safety checks for `windowStart` field - if missing, the record is automatically reset

3. **Boundary Detection**: Improved window comparison to ensure stale records from different days are properly detected and reset

4. **Auto-Cleanup**: `getServerRateLimitStatus` now updates stale records automatically during read operations

## Future Improvements

- Add automatic cleanup job for records older than 48 hours
- Add better logging to track window reset events
- Implement rate limit analytics/dashboard
- Add TTL (Time To Live) to Firestore documents (24 hour expiry)
