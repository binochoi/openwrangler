export default defineNitroPlugin((nitroApp) => {
  nitroApp.hooks.hook('error', (error, { event: e }) => {
    console.error(error.message, {
      path: e?.path,
      method: e?.method,
    })
  })
})
