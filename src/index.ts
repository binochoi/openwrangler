import type { D1Database, KVNamespace, R2Bucket } from '@cloudflare/workers-types/experimental'
import type { R2Config } from './bindings/r2'
import { createD1Binding as createD1BindingImpl } from './bindings/d1'
import { createKVBinding as createKVBindingImpl } from './bindings/kv'
import { createR2Binding as createR2BindingImpl } from './bindings/r2'
import { CloudflareAPIClient } from './utils/http-client'

export interface BindingsConfig {
  accountId: string
  apiToken: string
}

export type { R2Config }

export function createR2Binding(config: R2Config, bucketName: string): R2Bucket {
  return createR2BindingImpl(config, bucketName)
}

export function createKVBinding(config: BindingsConfig, namespaceId: string): KVNamespace {
  const client = new CloudflareAPIClient(config.accountId, config.apiToken)
  return createKVBindingImpl(client, namespaceId)
}

export function createD1Binding(config: BindingsConfig, databaseId: string): D1Database {
  const client = new CloudflareAPIClient(config.accountId, config.apiToken)
  return createD1BindingImpl(client, databaseId)
}
