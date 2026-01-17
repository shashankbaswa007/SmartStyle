const nextJest = require('next/jest');

const createJestConfig = nextJest({
  // Provide the path to your Next.js app to load next.config.js and .env files in your test environment
  dir: './',
});

// Add any custom config to be passed to Jest
const customJestConfig = {
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
  testEnvironment: 'jest-environment-jsdom',
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    '^@/components/(.*)$': '<rootDir>/src/components/$1',
    '^@/lib/(.*)$': '<rootDir>/src/lib/$1',
    '^@/ai/(.*)$': '<rootDir>/src/ai/$1',
    'yaml': '<rootDir>/node_modules/yaml/dist/index.js',
  },
  testMatch: [
    '**/__tests__/**/*.[jt]s?(x)',
    '**/tests/integration/**/*.[jt]s?(x)',
    '**/tests/api/**/*.[jt]s?(x)',
  ],
  testPathIgnorePatterns: [
    '/node_modules/',
    '/tests/e2e/',  // Playwright E2E tests
    '/.next/',
    '/out/',
  ],
  transformIgnorePatterns: [
    'node_modules/(?!(msw|@mswjs|yaml)/)',
  ],
  collectCoverageFrom: [
    'src/**/*.{js,jsx,ts,tsx}',
    '!src/**/*.d.ts',
    '!src/**/*.stories.{js,jsx,ts,tsx}',
    '!src/**/__tests__/**',
    '!src/app/**',  // Exclude Next.js app directory
    '!src/ai/**',   // Exclude Genkit AI (complex dependencies)
  ],
  coverageThreshold: {
    global: {
      branches: 70,
      functions: 70,
      lines: 70,
      statements: 70,
    },
  },
};

// createJestConfig is exported this way to ensure that next/jest can load the Next.js config which is async
module.exports = createJestConfig(customJestConfig);
