// @ts-check
import withNuxt from './.nuxt/eslint.config.mjs'
import unusedImports from 'eslint-plugin-unused-imports'

export default withNuxt({
  plugins: {
    'unused-imports': unusedImports,
  },
  rules: {
    'vue/attribute-hyphenation': ['error', 'never'],
    'unused-imports/no-unused-imports': 'error',
  },
})
