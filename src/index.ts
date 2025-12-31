export interface BindingsConfig {
  accountId: string
  apiToken: string
}

export interface R2Binding {
  list(): Promise<unknown>
  get(key: string): Promise<unknown>
  put(key: string, value: unknown): Promise<void>
  delete(key: string): Promise<void>
}

export interface KVBinding {
  get(key: string): Promise<unknown>
  put(key: string, value: unknown): Promise<void>
  delete(key: string): Promise<void>
  list(): Promise<unknown>
}

export interface D1Binding {
  exec(query: string): Promise<unknown>
  prepare(query: string): unknown
}

export interface Bindings {
  r2: R2Binding
  kv: KVBinding
  d1: D1Binding
}

export function getBindings(config: BindingsConfig): Bindings {
  // TODO: Implement Cloudflare REST API calls
  return {
    r2: {
      async list() { throw new Error('Not implemented') },
      async get(key) { throw new Error('Not implemented') },
      async put(key, value) { throw new Error('Not implemented') },
      async delete(key) { throw new Error('Not implemented') },
    },
    kv: {
      async get(key) { throw new Error('Not implemented') },
      async put(key, value) { throw new Error('Not implemented') },
      async delete(key) { throw new Error('Not implemented') },
      async list() { throw new Error('Not implemented') },
    },
    d1: {
      async exec(query) { throw new Error('Not implemented') },
      prepare(query) { throw new Error('Not implemented') },
    },
  }
}
