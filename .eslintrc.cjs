module.exports = {
  env: {
    browser: false,
    es2022: true,
    node: true,
  },
  extends: [
    'airbnb-base',
  ],
  parserOptions: {
    ecmaVersion: 2022,
    sourceType: 'module',
  },
  rules: {
    'no-console': 'off',
    'max-len': ['error', { code: 160 }],
    'import/extensions': ['error', 'ignorePackages', { js: 'always' }],
  },
};
