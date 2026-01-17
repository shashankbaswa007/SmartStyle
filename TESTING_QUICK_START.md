# Quick Start: Running Tests

## Run All Tests (Fastest)
```bash
npm test
```
**Output:** 51 tests in 3.4 seconds ✅

## Run with Coverage
```bash
npm run test:coverage
```
**Shows:** Coverage report for src/lib/ business logic

## Run E2E Tests
```bash
# Terminal 1: Start dev server
npm run dev

# Terminal 2: Run Playwright
npm run test:e2e
```
**Tests:** Complete user journeys in real browsers

## Run Tests in Watch Mode
```bash
npm run test:watch
```
**Use for:** Test-driven development (TDD)

## Test Categories

| Command | Tests | Time | Purpose |
|---------|-------|------|---------|
| `npm run test:unit` | 32 tests | 2s | Business logic |
| `npm run test:integration` | 4 tests | 0.5s | API validation |
| `npm run test:api` | 13 tests | 0.5s | Endpoint testing |
| `npm run test:e2e` | 7 tests | 30s | User journeys |

## Current Status
- ✅ **51/51 tests passing** (100% success rate)
- ✅ **Build successful** (0 errors)
- ✅ **Fast execution** (3.4 seconds for all Jest tests)
- ⚠️ **Coverage:** 1.71% overall (UI excluded), ~35% for business logic

## Coverage Target
**Goal:** 70% coverage
**Strategy:** 
1. Test more functions in `src/lib/personalization.ts` (888 lines)
2. Add component tests for `src/components/style-advisor.tsx`
3. Test `src/lib/cache.ts` and `src/lib/likedOutfits.ts`

## Files Tested
- ✅ `src/lib/utils.ts` - 100% coverage
- ✅ `src/lib/validation/schemas.ts` - 63% coverage
- ✅ `src/lib/transactions.ts` - 16% coverage (retry logic)
- ✅ `src/lib/firebase.ts` - 56% coverage (initialization)

## Next Steps
1. Add test images to `tests/fixtures/` for E2E tests
2. Run E2E tests: `npm run test:e2e`
3. Add more unit tests for personalization logic
4. Consider excluding UI from coverage targets or add component tests

## Documentation
- Full guide: [COMPREHENSIVE_TESTING_GUIDE.md](COMPREHENSIVE_TESTING_GUIDE.md)
- Implementation details: [TESTING_IMPLEMENTATION_SUMMARY.md](TESTING_IMPLEMENTATION_SUMMARY.md)
