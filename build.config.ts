import { defineBuildConfig } from 'unbuild'

export default defineBuildConfig({
  entries: ['src/index'],
  declaration: true,
  clean: true,
  externals: ['@cloudflare/workers-types'],
  rollup: {
    emitCJS: false,
  },
})
