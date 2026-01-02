import type { R2Bucket, KVNamespace, D1Database } from '@cloudflare/workers-types/experimental'
import { CloudflareAPIClient } from './utils/http-client'
import { createKVBinding as createKVBindingImpl } from './bindings/kv'
import { createD1Binding as createD1BindingImpl } from './bindings/d1'

export interface BindingsConfig {
  accountId: string
  apiToken: string
}

export function createR2Binding(config: BindingsConfig, bucketName: string): R2Bucket {
  // TODO: Implement Cloudflare R2 REST API calls for bucketName
  // R2 requires S3-compatible API with separate Access Key credentials
  throw new Error('R2 binding not yet implemented. Use KV or D1 instead.')
}

export function createKVBinding(config: BindingsConfig, namespaceId: string): KVNamespace {
  const client = new CloudflareAPIClient(config.accountId, config.apiToken)
  return createKVBindingImpl(client, namespaceId)
}

export function createD1Binding(config: BindingsConfig, databaseId: string): D1Database {
  const client = new CloudflareAPIClient(config.accountId, config.apiToken)
  return createD1BindingImpl(client, databaseId)
}
