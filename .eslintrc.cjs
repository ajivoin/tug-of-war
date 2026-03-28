module.exports = {
  env: {
    browser: false,
    es2022: true,
    node: true,
  },
  extends: [
    'airbnb-base',
    'airbnb-typescript/base',
    'plugin:@typescript-eslint/recommended',
  ],
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaVersion: 2022,
    sourceType: 'module',
    project: './tsconfig.json',
  },
  plugins: ['@typescript-eslint'],
  rules: {
    'no-console': 'off',
    'max-len': ['error', { code: 160 }],
    'import/extensions': ['error', 'ignorePackages', { js: 'always' }],
  },
};
