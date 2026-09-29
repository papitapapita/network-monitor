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
  // ADR 0002: the on-site agent only measures and reports. It reuses the
  // probe adapters but never a database, Express, the DI container or a use
  // case. tests/agent/importBoundary.test.ts checks the same thing for
  // everything the agent pulls in indirectly.
  {
    files: ['src/agent/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: [
                '@prisma/*',
                'prisma',
                'pg',
                '**/generated/prisma*',
                '**/generated/prisma/**',
                '@/generated/*'
              ],
              message: 'The agent has no database (ADR 0002).'
            },
            {
              group: ['express', 'express-*', 'helmet', 'cors'],
              message: 'The agent serves no HTTP (ADR 0002).'
            },
            {
              group: ['**/di', '**/di/*'],
              message:
                'The agent has its own composition root, src/agent/main.ts.'
            },
            {
              group: [
                '**/use-cases',
                '**/use-cases/*',
                '**/repository',
                '**/repositories',
                '**/repositories/*',
                '**/persistence/*',
                'presentation/*',
                '**/presentation/*'
              ],
              message:
                'The agent measures; deciding stays on the backend (ADR 0002).'
            },
            {
              group: [
                'domain/*',
                '!domain/shared',
                'domain/shared/*',
                '!domain/shared/core',
                '!domain/shared/core/*'
              ],
              message:
                'The agent uses no domain model beyond Result (ADR 0002).'
            }
          ]
        }
      ]
    }
  },
  {
    files: ['src/**/*.ts'],
    ignores: ['src/agent/**'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: [
                'agent/*',
                '!agent/protocol',
                '!agent/protocol/*'
              ],
              message:
                'The backend shares only src/agent/protocol with the agent.'
            }
          ]
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
