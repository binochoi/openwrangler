import superjson from 'superjson'

export const $api = $fetch.create({
  onRequest: [
    ({ options }) => {
      options.headers = {
        ...useRequestHeaders(),
        ...options.headers,
      }
      if (options.body && (options.body instanceof FormData) === false) {
        options.body = superjson.serialize(options.body)
      }
    },
  ],
  onResponse: [
    async ({ response }) => {
      const contentType = response.headers.get('content-type')
      if (contentType?.includes('application/json')) {
        const data = response._data
        if (data && typeof data === 'object' && 'json' in data) {
          response._data = superjson.deserialize(data)
        }
      }
    },
  ],
})
