module.exports = {
  parser: '@babel/eslint-parser',
  env: {
    browser: false,
    commonjs: true,
    es2021: true,
  },
  extends: [
    'airbnb-base',
  ],
  parserOptions: {
    ecmaVersion: 2020,
  },
  rules: {
    'no-console': 'off',
    'max-len': ["error", {"code": 160}]
  },
};
