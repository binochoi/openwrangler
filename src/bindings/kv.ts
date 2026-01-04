import type {
  KVNamespace,
  KVNamespaceGetWithMetadataResult,
  KVNamespaceListOptions,
  KVNamespaceListResult,
  KVNamespacePutOptions,
} from '@cloudflare/workers-types/experimental'
import type { CloudflareAPIClient } from '../utils/http-client'

interface KVAPIListResponse {
  keys: Array<{
    name: string
    expiration?: number
    metadata?: unknown
  }>
  list_complete: boolean
  cursor?: string
}

export function createKVBinding(
  client: CloudflareAPIClient,
  namespaceId: string,
): KVNamespace {
  const baseEndpoint = `/accounts/${client.getAccountId()}/storage/kv/namespaces/${namespaceId}`

  async function getValue(
    key: string,
    type: 'text' | 'json' | 'arrayBuffer' | 'stream' | undefined,
    cacheTtl?: number,
  ): Promise<any> {
    try {
      const url = `${baseEndpoint}/values/${encodeURIComponent(key)}`
      const headers: Record<string, string> = {}

      if (cacheTtl !== undefined) {
        headers['Cache-Control'] = `max-age=${cacheTtl}`
      }

      // KV API returns raw value, not wrapped in result
      const response = await fetch(`https://api.cloudflare.com/client/v4${url}`, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${(client as any).apiToken}`,
          ...headers,
        },
      })

      if (response.status === 404) {
        return null
      }

      if (!response.ok) {
        throw new Error(`KV GET failed: ${response.status}`)
      }

      switch (type) {
        case 'json':
          return await response.json()
        case 'arrayBuffer':
          return await response.arrayBuffer()
        case 'stream':
          return response.body
        case 'text':
        default:
          return await response.text()
      }
    }
    catch (error) {
      if ((error as any)?.message?.includes('404')) {
        return null
      }
      throw error
    }
  }

  async function getValueWithMetadata(
    key: string,
    type: 'text' | 'json' | 'arrayBuffer' | 'stream' | undefined,
  ): Promise<KVNamespaceGetWithMetadataResult<any, any>> {
    try {
      const url = `${baseEndpoint}/values/${encodeURIComponent(key)}`

      const response = await fetch(`https://api.cloudflare.com/client/v4${url}`, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${(client as any).apiToken}`,
        },
      })

      if (response.status === 404) {
        return { value: null, metadata: null, cacheStatus: null }
      }

      if (!response.ok) {
        throw new Error(`KV GET failed: ${response.status}`)
      }

      const metadata = response.headers.get('cf-kv-metadata')
      const parsedMetadata = metadata ? JSON.parse(metadata) : null

      let value: any
      switch (type) {
        case 'json':
          value = await response.json()
          break
        case 'arrayBuffer':
          value = await response.arrayBuffer()
          break
        case 'stream':
          value = response.body
          break
        case 'text':
        default:
          value = await response.text()
      }

      return {
        value,
        metadata: parsedMetadata,
        cacheStatus: response.headers.get('cf-cache-status'),
      }
    }
    catch (error) {
      if ((error as any)?.message?.includes('404')) {
        return { value: null, metadata: null, cacheStatus: null }
      }
      throw error
    }
  }

  const kvNamespace: KVNamespace = {
    async get(key: any, options?: any): Promise<any> {
      // Handle array of keys
      if (Array.isArray(key)) {
        const type = typeof options === 'string' ? options : options?.type || 'text'
        const results = new Map()

        for (const k of key) {
          const value = await getValue(k, type, options?.cacheTtl)
          results.set(k, value)
        }

        return results
      }

      // Single key
      const type = typeof options === 'string' ? options : options?.type
      return getValue(key, type, options?.cacheTtl)
    },

    async put(
      key: string,
      value: string | ArrayBuffer | ArrayBufferView | ReadableStream,
      options?: KVNamespacePutOptions,
    ): Promise<void> {
      const url = `${baseEndpoint}/values/${encodeURIComponent(key)}`
      const headers: Record<string, string> = {
        Authorization: `Bearer ${(client as any).apiToken}`,
      }

      let body: string | ArrayBuffer
      if (typeof value === 'string') {
        body = value
      }
      else if (value instanceof ArrayBuffer) {
        body = value
      }
      else if (ArrayBuffer.isView(value)) {
        body = value.buffer.slice(value.byteOffset, value.byteOffset + value.byteLength)
      }
      else if (value instanceof ReadableStream) {
        // Convert ReadableStream to ArrayBuffer
        const reader = value.getReader()
        const chunks: Uint8Array[] = []

        while (true) {
          const { done, value: chunk } = await reader.read()
          if (done)
            break
          chunks.push(chunk)
        }

        const totalLength = chunks.reduce((acc, chunk) => acc + chunk.length, 0)
        const result = new Uint8Array(totalLength)
        let offset = 0
        for (const chunk of chunks) {
          result.set(chunk, offset)
          offset += chunk.length
        }
        body = result.buffer
      }
      else {
        throw new TypeError('Unsupported value type')
      }

      const queryParams = new URLSearchParams()
      if (options?.expiration) {
        queryParams.set('expiration', options.expiration.toString())
      }
      if (options?.expirationTtl) {
        queryParams.set('expiration_ttl', options.expirationTtl.toString())
      }

      const queryString = queryParams.toString()
      const fullUrl = queryString ? `${url}?${queryString}` : url

      const response = await fetch(`https://api.cloudflare.com/client/v4${fullUrl}`, {
        method: 'PUT',
        headers,
        body,
      })

      if (!response.ok) {
        throw new Error(`KV PUT failed: ${response.status}`)
      }
    },

    async delete(key: string): Promise<void> {
      const url = `${baseEndpoint}/values/${encodeURIComponent(key)}`

      const response = await fetch(`https://api.cloudflare.com/client/v4${url}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${(client as any).apiToken}`,
        },
      })

      if (!response.ok && response.status !== 404) {
        throw new Error(`KV DELETE failed: ${response.status}`)
      }
    },

    async deleteBulk(keys: string | string[]): Promise<void> {
      const keyArray = Array.isArray(keys) ? keys : [keys]
      const url = `${baseEndpoint}/bulk`

      const response = await fetch(`https://api.cloudflare.com/client/v4${url}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${(client as any).apiToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(keyArray),
      })

      if (!response.ok) {
        throw new Error(`KV DELETE BULK failed: ${response.status}`)
      }
    },

    async list<Metadata = unknown>(
      options?: KVNamespaceListOptions,
    ): Promise<KVNamespaceListResult<Metadata>> {
      const queryParams = new URLSearchParams()

      if (options?.limit) {
        queryParams.set('limit', options.limit.toString())
      }
      if (options?.prefix) {
        queryParams.set('prefix', options.prefix)
      }
      if (options?.cursor) {
        queryParams.set('cursor', options.cursor)
      }

      const queryString = queryParams.toString()
      const url = queryString ? `${baseEndpoint}/keys?${queryString}` : `${baseEndpoint}/keys`

      const data = await client.get<KVAPIListResponse>(url)

      if (data.list_complete) {
        return {
          list_complete: true,
          keys: data.keys.map(k => ({
            name: k.name,
            expiration: k.expiration,
            metadata: k.metadata as Metadata,
          })),
          cacheStatus: null,
        }
      }
      else {
        return {
          list_complete: false,
          keys: data.keys.map(k => ({
            name: k.name,
            expiration: k.expiration,
            metadata: k.metadata as Metadata,
          })),
          cursor: data.cursor!,
          cacheStatus: null,
        }
      }
    },

    async getWithMetadata(key: any, options?: any): Promise<any> {
      // Handle array of keys
      if (Array.isArray(key)) {
        const type = typeof options === 'string' ? options : options?.type || 'text'
        const results = new Map()

        for (const k of key) {
          const result = await getValueWithMetadata(k, type)
          results.set(k, result)
        }

        return results
      }

      // Single key
      const type = typeof options === 'string' ? options : options?.type
      return getValueWithMetadata(key, type)
    },
  }

  return kvNamespace
}
