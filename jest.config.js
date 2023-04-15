module.exports = {
  maxWorkers: '50%',
  preset: 'ts-jest',
  roots: ['<rootDir>/modules'],
  testMatch: ['**/?(*.)+(spec|test).+(ts|tsx)'],
  moduleNameMapper: {
    '@msagl/core/drawing': '<rootDir>/modules/core/src/drawing',
    '@msagl/core': '<rootDir>/modules/core/src',
    '@msagl/parser': '<rootDir>/modules/parser/src',
    '@msagl/renderer': '<rootDir>/modules/renderer/src',
  },
}
