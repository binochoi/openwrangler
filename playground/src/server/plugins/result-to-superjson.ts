import superjson from 'superjson'

export default defineNitroPlugin((nitroApp) => {
  nitroApp.hooks.hook('beforeResponse', (e, { body }) => {
    if (!e.path.startsWith('/api')) {
      return
    }
    send(e, superjson.stringify(body))
  })
})
