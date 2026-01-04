/* eslint-disable @typescript-eslint/no-explicit-any */
export default defineEventHandler({
  async handler(event) {
    const env = event.context.cloudflare?.env

    if (!env?.R2Storage) {
      throw createError({
        statusCode: 500,
        message: 'R2Storage binding not found',
      })
    }

    const list = await (env.R2Storage as any).list()
    return list
  },
})
