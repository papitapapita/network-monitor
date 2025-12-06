/** @type {import('ts-jest').JestConfigWithTsJest} **/
export default {
  preset: 'ts-jest',
  testEnvironment: 'node',
  transform: {
    '^.+.tsx?$': ['ts-jest', {}]
  },
  transformIgnorePatterns: [
    '/node_modules/(?!uuid)/' // Allow Jest to transform uuid
  ]
};
