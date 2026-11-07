import js from '@eslint/js';
import stylistic from '@stylistic/eslint-plugin';
import noComments from 'eslint-plugin-no-comments';
import { defineConfig, globalIgnores } from 'eslint/config';
import globals from 'globals';
import tseslint from 'typescript-eslint';

const style = stylistic.configs.customize({
  indent: 2,
  quotes: 'single',
  semi: true,
  jsx: false,
  commaDangle: 'always-multiline',
  arrowParens: true,
  braceStyle: '1tbs',
});

export default defineConfig(
  globalIgnores(['lib/**', 'node_modules/**', 'coverage/**']),
  {
    files: ['**/*.ts'],
    extends: [js.configs.recommended, tseslint.configs.recommendedTypeChecked],
    languageOptions: {
      globals: {
        ...globals.node,
      },
      sourceType: 'module',
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    linterOptions: {
      noInlineConfig: true,
    },
    rules: {
      '@typescript-eslint/unbound-method': 'off',
      'no-void': 'error',
      '@typescript-eslint/no-floating-promises': [
        'error',
        {
          ignoreVoid: false,
          allowForKnownSafeCalls: [
            { from: 'package', name: 'test', package: 'node:test' },
          ],
        },
      ],
      '@typescript-eslint/no-misused-promises': 'error',
      '@typescript-eslint/await-thenable': 'error',
      '@typescript-eslint/no-non-null-assertion': 'error',
      '@typescript-eslint/explicit-function-return-type': [
        'error',
        { allowExpressions: true },
      ],
      '@typescript-eslint/consistent-type-imports': 'error',
      '@typescript-eslint/prefer-nullish-coalescing': 'error',
      '@typescript-eslint/prefer-optional-chain': 'error',
      'eqeqeq': ['error', 'always', { null: 'ignore' }],
      'no-duplicate-imports': 'error',
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^_',
        },
      ],
      'curly': ['error', 'all'],
    },
  },
  {
    files: ['**/*.mjs'],
    extends: [js.configs.recommended],
    languageOptions: {
      globals: {
        ...globals.node,
      },
      sourceType: 'module',
    },
    linterOptions: {
      noInlineConfig: true,
    },
  },
  {
    files: ['**/*.{ts,mjs}'],
    plugins: {
      ...style.plugins,
      'no-comments': noComments,
    },
    rules: {
      ...style.rules,
      'curly': ['error', 'all'],
      'no-comments/disallowComments': ['error', { allow: ['(?!)'] }],
    },
  },
);
