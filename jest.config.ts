export default {
  moduleFileExtensions: ['js', 'json', 'ts'],
  rootDir: 'src',
  testRegex: '.*\\.spec\\.ts$',
  transform: {
    '^.+\\.(t|j)s$': 'ts-jest',
  },
  collectCoverageFrom: ['**/*.(t|j)s'],
  coverageDirectory: '../coverage',
  testEnvironment: 'node',
  moduleNameMapper: {
    // <rootDir> maps directly to your 'src' folder
    '^@auth/(.*)$': '<rootDir>/auth/$1',
    '^@common/(.*)$': '<rootDir>/@common/$1' 
  }
};