import { type Config } from 'jest'

const config: Config = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx'],
  transform: {
    '^.+\\.[tj]sx?$': 'ts-jest',
  },
  testTimeout: 30000,
}

export default config