import { readFile } from 'fs/promises'

export default defineEventHandler({
  onRequest: [],
  async handler(e) {
    const buffer = await readFile('a.png')
    return e.context.cloudflare.env.R2Storage.put('asd', buffer)
  },
})
