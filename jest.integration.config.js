/** @type {import('ts-jest').JestConfigWithTsJest} **/
export default {
  preset: 'ts-jest',
  testEnvironment: 'node',
  extensionsToTreatAsEsm: ['.ts'],
  transform: {
    '^.+\\.tsx?$': ['ts-jest', { tsconfig: 'tsconfig.json', useESM: true }]
  },
  testMatch: ['<rootDir>/tests/integration/**/*.test.ts'],
  testPathIgnorePatterns: ['/node_modules/', '/dist/'],
  transformIgnorePatterns: [
    '/node_modules/(?!uuid)/'
  ],
  moduleNameMapper: {
    '^domain/(.*)$': '<rootDir>/src/domain/$1',
    '^application/(.*)$': '<rootDir>/src/application/$1',
    '^infrastructure/(.*)$': '<rootDir>/src/infrastructure/$1',
    '^presentation/(.*)$': '<rootDir>/src/presentation/$1',
    '^generated/(.*)$': '<rootDir>/src/generated/$1',
    '^(\\.\\.?/.+)\\.js$': '$1'
  },
  setupFiles: ['<rootDir>/tests/integration/setup.ts'],
  testTimeout: 30000
};
