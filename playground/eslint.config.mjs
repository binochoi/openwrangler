import unusedImports from 'eslint-plugin-unused-imports'
// @ts-check
import withNuxt from './.nuxt/eslint.config.mjs'

export default withNuxt({
  plugins: {
    'unused-imports': unusedImports,
  },
  rules: {
    'vue/attribute-hyphenation': ['error', 'never'],
    'unused-imports/no-unused-imports': 'error',
  },
})
