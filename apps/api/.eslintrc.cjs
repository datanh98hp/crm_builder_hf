module.exports = {
  root: true,
  parser: '@typescript-eslint/parser',
  parserOptions: { project: './tsconfig.json', tsconfigRootDir: __dirname, sourceType: 'module' },
  plugins: ['@typescript-eslint'],
  extends: ['plugin:@typescript-eslint/recommended', 'prettier'],
  env: { node: true, jest: true },
  ignorePatterns: ['dist', '*.cjs', 'prisma.config.ts'],
  rules: {
    '@typescript-eslint/no-explicit-any': 'error',
    '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    // Promises that are neither awaited nor handled hide failures (jobs, audit writes, shutdown).
    '@typescript-eslint/no-floating-promises': 'error',
    '@typescript-eslint/no-misused-promises': 'error',
    '@typescript-eslint/await-thenable': 'error',
    eqeqeq: ['error', 'always'],
    'no-console': 'error',
    complexity: ['warn', 10],
    'max-lines-per-function': ['warn', { max: 60, skipBlankLines: true, skipComments: true }],
    'max-params': ['warn', 5],
  },
  overrides: [
    // Test bodies are long by nature; keep the other rules.
    { files: ['test/**/*.ts', '**/*.spec.ts'], rules: { 'max-lines-per-function': 'off', 'no-console': 'off' } },
  ],
};
