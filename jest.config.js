/** @type {import('ts-jest').JestConfigWithTsJest} **/
export default {
  preset: 'ts-jest',
  testEnvironment: 'node',
  transform: {
    '^.+.tsx?$': ['ts-jest', { tsconfig: 'tsconfig.json' }]
  },
  // Integration tests need a real DB and .env.test; they run via
  // jest.integration.config.js only. Without this they leak into `npm test`.
  testPathIgnorePatterns: [
    '/node_modules/',
    '/dist/',
    '/.claude/',
    '/tests/integration/'
  ],
  transformIgnorePatterns: [
    '/node_modules/(?!uuid)/' // Allow Jest to transform uuid
  ],
  // Resolve bare path aliases that match tsconfig baseUrl: ./src
  moduleNameMapper: {
    '^domain/(.*)$': '<rootDir>/src/domain/$1',
    '^application/(.*)$': '<rootDir>/src/application/$1',
    '^infrastructure/(.*)$': '<rootDir>/src/infrastructure/$1',
    '^presentation/(.*)$': '<rootDir>/src/presentation/$1'
  }
};
