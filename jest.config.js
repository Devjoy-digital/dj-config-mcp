module.exports = {
  testEnvironment: 'node',
  testTimeout: 10000, // 10 seconds per test
  coverageDirectory: 'coverage',
  collectCoverageFrom: [
    'index.js',
    'lib/**/*.js',
    '!**/*.test.js',
    '!**/node_modules/**'
  ],
  coverageThreshold: {
    global: {
      branches: 70,
      functions: 70,
      lines: 70,
      statements: 70
    }
  }
};