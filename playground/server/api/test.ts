import { getBindings } from '../../..'

export default defineEventHandler(async () => {
  const bindings = getBindings({
    accountId: process.env.CF_ACCOUNT_ID || '',
    apiToken: process.env.CF_API_TOKEN || '',
  })

  // TODO: Test bindings here
  return {
    message: 'openwrangler playground',
    bindings: ['r2', 'kv', 'd1'],
  }
})
