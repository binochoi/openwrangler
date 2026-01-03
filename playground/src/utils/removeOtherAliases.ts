/* eslint-disable @typescript-eslint/no-dynamic-delete */
/* eslint-disable @typescript-eslint/no-explicit-any */
export default ({ tsConfig }: { tsConfig: any }) => {
  const aliasesToRemoveFromAutocomplete = ['src', 'src/*', '~', '~/*', '~~', '~~/*', '@@', '@@/*']
  for (const alias of aliasesToRemoveFromAutocomplete) {
    if (tsConfig.compilerOptions?.paths[alias]) {
      delete tsConfig.compilerOptions.paths[alias]
    }
  }
}
