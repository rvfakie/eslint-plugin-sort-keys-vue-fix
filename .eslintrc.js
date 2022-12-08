module.exports = {
  root: true,
  parserOptions: {
    ecmaVersion: 2020,
  },
  env: {
    browser: true,
    node: true, 
    es6: true,
  },
  extends: [
    "eslint:recommended",
  ],
  rules: {
    'no-console': [process.env.NODE_ENV === 'production' ? 'error' : 0, { allow: ["warn", "error"] }],
    'no-debugger': process.env.NODE_ENV === 'production' ? 'error' : 0,
    'no-var': 'warn',
    'prefer-const': 'warn',
    'no-else-return': 'error',
  },
}