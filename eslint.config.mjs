import antfu from '@antfu/eslint-config'

export default antfu({
  typescript: true,
  ignores: [
    'dist',
    'node_modules',
    '**/.nuxt',
    '**/.nitro',
    'packages/*/dist',
    '**/CLAUDE.md',
  ],
  rules: {
    // Allow assignment in while conditions (needed for XML parsing)
    'no-cond-assign': 'off',

    // Allow global process in Node.js environments
    'node/prefer-global/process': 'off',

    // Allow @ts-expect-error and @ts-ignore without descriptions
    'ts/ban-ts-comment': 'off',

    // Allow unused variables prefixed with underscore
    'unused-imports/no-unused-vars': [
      'error',
      {
        args: 'all',
        argsIgnorePattern: '^_',
        varsIgnorePattern: '^_',
      },
    ],
  },
})
