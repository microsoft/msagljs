module.exports = {
  maxWorkers: '50%',
  preset: 'ts-jest',
  roots: ['<rootDir>/modules'],
  testMatch: ['**/?(*.)+(spec|test).+(ts|tsx)'],
  moduleNameMapper: {
    '@msagl/drawing': '<rootDir>/modules/drawing/src',
    '@msagl/core': '<rootDir>/modules/core/src',
    '@msagl/parser': '<rootDir>/modules/parser/src',
    '@msagl/renderer-common': '<rootDir>/modules/renderer-common/src',
    '@msagl/renderer-svg': '<rootDir>/modules/renderer-svg/src',
    '@msagl/renderer-webgl': '<rootDir>/modules/renderer-svg/webgl',
  },
}
