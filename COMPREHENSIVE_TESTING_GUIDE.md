# Comprehensive Testing Guide for SmartStyle

Complete testing infrastructure with unit, integration, API, and E2E tests.

## Quick Start

```bash
# Run all tests
npm test

# Run with coverage (target: 70%)
npm run test:coverage

# Run E2E tests
npm run test:e2e
```

## Test Scripts

| Command | Description |
|---------|-------------|
| `npm test` | Run all Jest tests |
| `npm run test:watch` | Watch mode for development |
| `npm run test:coverage` | Generate coverage report |
| `npm run test:unit` | Unit tests only (src/) |
| `npm run test:integration` | Integration tests with mocks |
| `npm run test:api` | API endpoint tests |
| `npm run test:e2e` | Playwright E2E tests |
| `npm run test:e2e:headed` | E2E with visible browser |
| `npm run test:e2e:debug` | Debug with Playwright Inspector |
| `npm run test:all` | All test types sequentially |
| `npm run test:ci` | CI pipeline (coverage + E2E) |

## Test Structure

```
SmartStyle/
├── jest.config.js              # Jest configuration
├── jest.setup.js               # Global test setup
├── playwright.config.ts        # Playwright E2E config
│
├── src/lib/__tests__/          # Unit tests
│   ├── utils.test.ts           # Utility functions (cn)
│   ├── personalization.test.ts # Color scoring, preferences
│   └── transactions.test.ts    # Firestore transactions
│
├── src/lib/validation/__tests__/
│   └── schemas.test.ts         # Zod validation schemas
│
└── tests/
    ├── fixtures/               # Test data
    │   └── README.md
    │
    ├── mocks/                  # MSW API mocking
    │   ├── handlers.ts         # Mock API responses
    │   ├── server.ts           # Node.js MSW server
    │   └── browser.ts          # Browser MSW worker
    │
    ├── integration/            # Integration tests
    │   └── recommendation-flow.test.ts
    │
    ├── api/                    # API endpoint tests
    │   └── recommend.test.ts
    │
    └── e2e/                    # End-to-end tests
        └── user-journey.spec.ts
```

## Coverage Goals

**Target: 70% across all metrics**

- ✅ Branches: 70%
- ✅ Functions: 70%
- ✅ Lines: 70%
- ✅ Statements: 70%

View report:
```bash
npm run test:coverage
open coverage/lcov-report/index.html
```

## Test Categories

### 1. Unit Tests (`src/lib/__tests__/`)

**Purpose**: Test individual functions in isolation

**Examples**:
- [utils.test.ts](src/lib/__tests__/utils.test.ts) - `cn()` class merger
- [schemas.test.ts](src/lib/validation/__tests__/schemas.test.ts) - Zod validation
- [transactions.test.ts](src/lib/__tests__/transactions.test.ts) - Retry logic
- [personalization.test.ts](src/lib/__tests__/personalization.test.ts) - Color scoring

**Run**: `npm run test:unit`

### 2. Integration Tests (`tests/integration/`)

**Purpose**: Test multiple components working together with mocked APIs

**Key File**: [recommendation-flow.test.ts](tests/integration/recommendation-flow.test.ts)
- Mocks AI APIs (Groq, Gemini) with MSW
- Mocks Tavily search API
- Tests full recommendation pipeline

**Run**: `npm run test:integration`

### 3. API Tests (`tests/api/`)

**Purpose**: Test API endpoints, validation, error handling

**Key File**: [recommend.test.ts](tests/api/recommend.test.ts)
- Request validation (missing fields, invalid data)
- Error scenarios (AI failures, quota exceeded)
- Rate limiting

**Run**: `npm run test:api`

### 4. E2E Tests (`tests/e2e/`)

**Purpose**: Test complete user journeys in real browser

**Key File**: [user-journey.spec.ts](tests/e2e/user-journey.spec.ts)
- Authentication flow
- Image upload → Recommendations
- Like/unlike workflows
- Analytics page
- Mobile responsive
- Error handling

**Run**: `npm run test:e2e`

## Writing Tests

### Unit Test Example
```typescript
// src/lib/__tests__/color-utils.test.ts
describe('Color Utilities', () => {
  it('should calculate color similarity', () => {
    const similarity = calculateColorSimilarity('#FF5733', '#FF5744');
    expect(similarity).toBeGreaterThan(0.9);
  });

  it('should handle invalid hex codes', () => {
    expect(() => calculateColorSimilarity('invalid', '#FF5733'))
      .toThrow('Invalid hex color');
  });
});
```

### Integration Test with MSW
```typescript
// tests/integration/search-flow.test.ts
import { server } from '../mocks/server';
import { http, HttpResponse } from 'msw';

describe('Product Search', () => {
  beforeAll(() => server.listen());
  afterEach(() => server.resetHandlers());
  afterAll(() => server.close());

  it('should search products with mocked API', async () => {
    // Mock is already configured in handlers.ts
    const results = await searchProducts('blue dress');
    
    expect(results).toHaveLength(3);
    expect(results[0].platform).toBe('Amazon');
  });

  it('should handle API errors', async () => {
    // Override handler for this test
    server.use(
      http.post('/api/tavily/search', () => {
        return HttpResponse.json(
          { error: 'Service unavailable' },
          { status: 503 }
        );
      })
    );

    await expect(searchProducts('dress'))
      .rejects.toThrow('Service unavailable');
  });
});
```

### E2E Test Example
```typescript
// tests/e2e/checkout.spec.ts
import { test, expect } from '@playwright/test';

test('complete checkout flow', async ({ page }) => {
  await page.goto('http://localhost:3000');
  
  // Sign in
  await page.getByRole('button', { name: 'Sign In' }).click();
  await page.getByLabel('Email').fill('test@example.com');
  await page.getByLabel('Password').fill('password123');
  await page.getByRole('button', { name: 'Sign In' }).click();
  
  // Upload image
  await page.getByLabel('Upload outfit photo').setInputFiles('tests/fixtures/test-outfit.jpg');
  await page.getByRole('button', { name: 'Get Recommendations' }).click();
  
  // Wait for recommendations
  await expect(page.getByText('Outfit 1')).toBeVisible({ timeout: 30000 });
  
  // Click shopping link
  await page.getByRole('link', { name: 'Shop on Amazon' }).first().click();
  
  // Verify new tab opened
  const [newPage] = await Promise.all([
    page.waitForEvent('popup'),
  ]);
  expect(newPage.url()).toContain('amazon.in');
});
```

## Mock API Setup (MSW)

### handlers.ts
```typescript
import { http, HttpResponse } from 'msw';

export const handlers = [
  http.post('/api/recommend', async ({ request }) => {
    const body = await request.json();
    
    return HttpResponse.json({
      success: true,
      recommendations: {
        outfit1: { /* ... */ },
        outfit2: { /* ... */ },
        outfit3: { /* ... */ },
      },
    });
  }),
];
```

### Using in Tests
```typescript
import { server } from '../mocks/server';

beforeAll(() => server.listen());
afterEach(() => server.resetHandlers());
afterAll(() => server.close());
```

## Debugging

### Debug Jest Tests
```bash
# Add 'debugger;' statement in test
node --inspect-brk node_modules/.bin/jest --runInBand <test-file>

# Open chrome://inspect in Chrome
```

### Debug Playwright Tests
```bash
npm run test:e2e:debug

# Opens Playwright Inspector
# Click "Pick Locator" to find selectors
# Step through test execution
```

### Verbose Output
```bash
npm test -- --verbose           # All output
npm test -- --silent           # Suppress logs
npm test -- utils.test.ts      # Specific test
npm test -- --watch            # Watch mode
```

## Common Issues

### ❌ Firebase not initialized
```bash
Error: Firebase app not initialized
```
**Fix**: Check [jest.setup.js](jest.setup.js) has Firebase mocks

### ❌ MSW not intercepting
```bash
TypeError: fetch failed
```
**Fix**: 
- Ensure `server.listen()` in `beforeAll`
- Use `http.post` not `rest.post` (MSW 2.x)
- Check handler URL matches request

### ❌ Playwright timeout
```bash
TimeoutError: page.getByRole timeout
```
**Fix**:
- Increase timeout: `{ timeout: 60000 }`
- Check selector: `page.locator('[data-testid="upload"]')`
- Ensure dev server running: `npm run dev`

### ❌ Module not found
```bash
Cannot find module '@/lib/utils'
```
**Fix**: Check `moduleNameMapper` in [jest.config.js](jest.config.js)

## CI/CD Integration

### GitHub Actions
```yaml
name: Tests
on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - uses: actions/setup-node@v3
        with:
          node-version: '20'
          cache: 'npm'
      
      - run: npm ci
      
      - run: npm run test:coverage
      
      - run: npx playwright install --with-deps
      
      - run: npm run test:e2e
      
      - uses: actions/upload-artifact@v3
        if: always()
        with:
          name: test-results
          path: |
            coverage/
            playwright-report/
            test-results/
```

## Test Fixtures

**Location**: `tests/fixtures/`

Required files (add before running E2E):
- `test-outfit.jpg` - Sample outfit photo (400x600px recommended)
- `blue-dress.jpg` - Blue dress for color tests
- `invalid-image.txt` - Text file for error handling

**Create fixtures**:
```bash
mkdir -p tests/fixtures
# Add test images to tests/fixtures/
```

## Performance

### Speed Benchmarks
- Unit tests: < 5 seconds
- Integration tests: < 10 seconds
- API tests: < 5 seconds
- E2E tests: < 60 seconds
- **Total suite**: < 90 seconds

### Optimization Tips
1. Run unit tests first (fastest feedback)
2. Use `test.concurrent` for independent Playwright tests
3. Mock heavy operations (image processing, AI calls)
4. Skip unnecessary setup in unit tests
5. Use `--maxWorkers=50%` for parallel Jest execution

## Best Practices

### ✅ DO
- Write descriptive test names
- Test one thing per test
- Use `beforeEach` for test isolation
- Mock external services (APIs, Firebase)
- Test error scenarios
- Keep tests fast and focused

### ❌ DON'T
- Don't test implementation details
- Don't share state between tests
- Don't mock everything (integration tests need some real code)
- Don't skip error cases
- Don't ignore flaky tests

## Maintenance

### Weekly
- Run full test suite: `npm run test:all`
- Check coverage: `npm run test:coverage`
- Review failed/flaky tests

### Monthly
- Update testing dependencies
- Review and remove obsolete tests
- Add tests for new features
- Check E2E fixtures are valid

### Release
- Run CI tests: `npm run test:ci`
- Verify 70% coverage maintained
- Check no skipped/disabled tests
- Update test documentation

## Resources

- **Jest**: https://jestjs.io/
- **React Testing Library**: https://testing-library.com/react
- **Playwright**: https://playwright.dev/
- **MSW**: https://mswjs.io/
- **Testing Best Practices**: https://kentcdodds.com/blog/common-mistakes-with-react-testing-library

## Summary

**Test Coverage**: 13 test files created
- ✅ 4 unit tests (utils, schemas, transactions, personalization)
- ✅ 1 integration test (recommendation flow)
- ✅ 1 API test (endpoint validation)
- ✅ 1 E2E test (complete user journey)
- ✅ MSW mocking infrastructure (handlers, server, browser)
- ✅ Jest config (70% coverage threshold)
- ✅ Playwright config (5 browsers)
- ✅ Test fixtures directory

**Next Steps**:
1. Add test image files to `tests/fixtures/`
2. Run tests: `npm test`
3. Check coverage: `npm run test:coverage`
4. Fix any failing tests
5. Add more tests to reach 70% coverage
