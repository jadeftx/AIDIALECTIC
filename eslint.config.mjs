import js from '@eslint/js';
import prettier from 'eslint-config-prettier';

const browserGlobals = {
  window: 'readonly',
  document: 'readonly',
  console: 'readonly',
  navigator: 'readonly',
  setTimeout: 'readonly',
  setInterval: 'readonly',
  clearInterval: 'readonly',
  confirm: 'readonly',
  alert: 'readonly',
  URL: 'readonly',
  Blob: 'readonly',
  FileReader: 'readonly',
  Node: 'readonly',
  Event: 'readonly',
  DataTransfer: 'readonly',
  ClipboardEvent: 'readonly',
  MutationObserver: 'readonly',
  HTMLElement: 'readonly',
  fetch: 'readonly',
  btoa: 'readonly',
  unescape: 'readonly',
  encodeURIComponent: 'readonly',
  crypto: 'readonly',
  chrome: 'readonly',
  marked: 'readonly',
};

export default [
  js.configs.recommended,
  prettier,
  {
    languageOptions: {
      ecmaVersion: 2021,
      sourceType: 'script',
      globals: browserGlobals,
    },
    rules: {
      'no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      // Global scope is shared via <script> tags — cross-file references are expected
      'no-undef': 'off',
      'no-redeclare': 'off',
    },
  },
  {
    ignores: ['node_modules/**', 'lib/**'],
  },
];
