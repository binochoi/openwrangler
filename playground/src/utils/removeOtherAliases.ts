export default ({ tsConfig }: { tsConfig: any }) => {
  const aliasesToRemoveFromAutocomplete = ['src', 'src/*', '~', '~/*', '~~', '~~/*', '@@', '@@/*']
  for (const alias of aliasesToRemoveFromAutocomplete) {
    if (tsConfig.compilerOptions?.paths[alias]) {
      delete tsConfig.compilerOptions.paths[alias]
    }
  }
}
