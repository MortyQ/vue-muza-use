import eslint from '@eslint/js'
import typescriptEslint from 'typescript-eslint'
import pluginVue from 'eslint-plugin-vue'
import stylistic from '@stylistic/eslint-plugin'
import globals from 'globals'
import importPlugin from 'eslint-plugin-import-x'

export const baseConfig = [
  {
    ignores: [
      '**/coverage/**',
      '**/dist/**',
      '*.config.ts',
      '*.config.mjs',
      '*.config.js',
    ],
  },

  eslint.configs.recommended,
  ...typescriptEslint.configs.recommended,
  ...pluginVue.configs['flat/recommended'],
  stylistic.configs.customize({
    pluginName: 'style',
  }),

  {
    files: ['**/*.{ts,js,vue}'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: {
        ...globals.browser,
        ...globals.es2022,
      },
      parser: pluginVue.parser,
      parserOptions: {
        parser: typescriptEslint.parser,
        sourceType: 'module',
      },
    },
    plugins: {
      import: importPlugin,
    },
    settings: {
      'import/resolver': {
        typescript: {
          project: ['./tsconfig.json'],
        },
        node: {
          extensions: ['.js', '.ts', '.vue'],
        },
      },
    },
    rules: {
      // ─── Unused variables ───────────────────────────────────────
      // Prefix with _ to intentionally mark a variable as unused.
      // Works for: args, vars, catch errors, destructured arrays.
      'no-unused-vars': 'off',
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^_',
          destructuredArrayIgnorePattern: '^_',
        },
      ],
      'vue/no-unused-vars': [
        'error',
        {
          ignorePattern: '^_',
        },
      ],

      // ─── TypeScript ──────────────────────────────────────────────
      '@typescript-eslint/no-explicit-any': 'warn',
      // Required when verbatimModuleSyntax: true in tsconfig
      '@typescript-eslint/consistent-type-imports': [
        'error',
        {
          prefer: 'type-imports',
          fixStyle: 'separate-type-imports',
          disallowTypeAnnotations: false,
        },
      ],

      // ─── Vue ─────────────────────────────────────────────────────
      'vue/multi-word-component-names': [
        'error',
        {
          ignores: ['index'],
        },
      ],
      'vue/no-empty-component-block': 'error',
      'vue/block-order': [
        'error',
        {
          order: ['script', 'template', 'style'],
        },
      ],
      'vue/define-macros-order': [
        'error',
        {
          order: ['defineOptions', 'defineProps', 'defineEmits', 'defineSlots'],
        },
      ],
      'vue/component-api-style': ['error', ['script-setup']],

      // ─── Imports ─────────────────────────────────────────────────
      'import/order': [
        'error',
        {
          'groups': [
            'builtin',
            'external',
            'internal',
            'parent',
            'sibling',
            'index',
          ],
          'pathGroups': [
            {
              pattern: 'vue',
              group: 'external',
              position: 'before',
            },
            {
              pattern: '@muzakit/**',
              group: 'internal',
              position: 'before',
            },
            {
              pattern: '@/**',
              group: 'internal',
              position: 'after',
            },
          ],
          'pathGroupsExcludedImportTypes': ['builtin', 'type'],
          'alphabetize': { order: 'asc', caseInsensitive: true },
          'newlines-between': 'always',
        },
      ],
      'import/newline-after-import': ['error', { count: 1 }],
      'import/no-duplicates': ['error', { 'prefer-inline': true }],

      // ─── Style ───────────────────────────────────────────────────
      'style/max-statements-per-line': 'off',
      'style/max-len': [
        'error',
        {
          code: 100,
          tabWidth: 2,
          ignoreUrls: true,
          ignoreStrings: true,
          ignoreTemplateLiterals: true,
          ignoreRegExpLiterals: true,
          ignoreComments: true,
          ignorePattern: '^\\s*@apply\\b',
        },
      ],
      'style/indent': ['error', 2],
      'style/semi': ['error', 'always'],
      'style/semi-style': ['error', 'last'],
      'style/quotes': [
        'error',
        'double',
        {
          allowTemplateLiterals: 'always',
          avoidEscape: false,
        },
      ],
      'style/quote-props': ['error', 'as-needed'],
      'style/jsx-quotes': ['error', 'prefer-double'],
      'style/comma-dangle': ['error', 'always-multiline'],
    },
  },

  // SVG and image Vue components — disable length rules
  {
    files: ['**/assets/**/*.vue', '**/svg/**/*.vue', '**/images/**/*.vue'],
    rules: {
      'style/max-len': 'off',
    },
  },
]
