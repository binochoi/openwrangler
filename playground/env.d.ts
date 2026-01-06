import type { CfProperties, Request, ExecutionContext, R2Bucket } from '@cloudflare/workers-types'

declare module 'h3' {
  interface H3EventContext {
    cf: CfProperties
    cloudflare: {
      request: Request
      env: {
        R2Storage: R2Bucket
      }
      context: ExecutionContext
    }
  }
}
