/** @type {import('jest').Config} */
module.exports = {
  testEnvironment: "node",
  testMatch: ["**/__tests__/**/*.test.js"],
  setupFilesAfterEnv: ["<rootDir>/jest.setup.js"],
  collectCoverageFrom: [
    "src/services/**/*.js",
    "src/lib/**/*.js",
    "!src/**/__tests__/**",
  ],
  coverageDirectory: "coverage",
  verbose: true,
};
