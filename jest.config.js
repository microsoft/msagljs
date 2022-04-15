module.exports = {
  preset: 'ts-jest',
  roots: ['<rootDir>/modules'],
  testMatch: ['**/?(*.)+(spec|test).+(ts|tsx)'],
  transform: {
    '^.+\\.[tj]s$': 'ts-jest',
  },
}
