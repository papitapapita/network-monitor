import globals from 'globals';
import pluginJs from '@eslint/js';
import tseslint from 'typescript-eslint';
import pluginJest from 'eslint-plugin-jest';
import prettier from 'eslint-config-prettier';

/** @type {import('eslint').Linter.Config[]} */
export default [
  { files: ['**/*.{js,mjs,cjs,ts}'] },
  {
    rules: {
      'no-unused-vars': 'error',
      'no-undef': 'error',
      'no-console': 'warn'
    },
    languageOptions: {
      globals: { ...globals.node, ...globals.jest }
    }
  },
  pluginJs.configs.recommended,
  ...tseslint.configs.recommended,
  {
    rules: {
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          ignoreRestSiblings: true
        }
      ]
    }
  },
  {
    files: ['**/*.test.ts', '**/*.spec.ts'],
    ...pluginJest.configs['flat/recommended']
  },
  prettier
];
