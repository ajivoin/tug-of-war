module.exports = {
  env: {
    browser: false,
    commonjs: true,
    es2022: true,
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
    'max-len': ["error", {"code": 160}],
    // Node's native ESM resolver requires explicit extensions on relative imports;
    // airbnb-base defaults this to "never", which is incompatible.
    'import/extensions': ['error', 'always', { ignorePackages: true }],
  },
};
