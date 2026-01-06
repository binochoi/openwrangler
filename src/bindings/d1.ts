import type { D1Database, D1ExecResult, D1PreparedStatement, D1Result } from '@cloudflare/workers-types/experimental'
import type { CloudflareAPIClient } from '../utils/http-client'

interface _D1APIQueryRequest {
  sql: string
  params?: unknown[]
}

interface D1APIQueryResponse {
  results: any[]
  success: true
  meta: {
    served_by?: string
    duration?: number
    changes?: number
    last_row_id?: number
    changed_db?: boolean
    size_after?: number
    rows_read?: number
    rows_written?: number
  }
}

class D1PreparedStatementImpl implements D1PreparedStatement {
  private bindings: unknown[] = []

  constructor(
    private query: string,
    private client: CloudflareAPIClient,
    private databaseId: string,
  ) {}

  bind(...values: unknown[]): D1PreparedStatement {
    this.bindings = values
    return this as D1PreparedStatement
  }

  async run<T = unknown>(): Promise<D1Result<T>> {
    const endpoint = `/accounts/${this.client.getAccountId()}/d1/database/${this.databaseId}/query`

    const data = await this.client.post<D1APIQueryResponse[]>(endpoint, {
      sql: this.query,
      params: this.bindings,
    })

    const result = data[0]

    return {
      success: result.success,
      results: result.results as T[],
      meta: {
        served_by: result.meta.served_by || '',
        duration: result.meta.duration || 0,
        changes: result.meta.changes || 0,
        last_row_id: result.meta.last_row_id || 0,
        changed_db: result.meta.changed_db || false,
        size_after: result.meta.size_after || 0,
        rows_read: result.meta.rows_read || 0,
        rows_written: result.meta.rows_written || 0,
      },
    }
  }

  async all<T = unknown>(): Promise<D1Result<T>> {
    return this.run<T>()
  }

  async first<T = unknown>(colName?: string): Promise<T | null> {
    const result = await this.run<T>()

    if (!result.results || result.results.length === 0) {
      return null
    }

    const firstRow = result.results[0]

    if (colName && typeof firstRow === 'object' && firstRow !== null) {
      return (firstRow as any)[colName] ?? null
    }

    return firstRow
  }

  raw<T = unknown[]>(options: { columnNames: true }): Promise<[string[], ...T[]]>
  raw<T = unknown[]>(options?: { columnNames?: false }): Promise<T[]>
  async raw<T = unknown[]>(options?: { columnNames?: boolean }): Promise<T[] | [string[], ...T[]]> {
    const result = await this.run()

    if (!result.results || result.results.length === 0) {
      return options?.columnNames ? [[] as unknown as string[], ...([] as T[])] : ([] as T[])
    }

    // Convert objects to arrays
    const raw = result.results.map((row) => {
      if (typeof row === 'object' && row !== null) {
        return Object.values(row) as T
      }
      return row as T
    })

    // If columnNames option is true, prepend column names as first row
    if (options?.columnNames && result.results.length > 0) {
      const firstRow = result.results[0]
      if (typeof firstRow === 'object' && firstRow !== null) {
        const columnNames = Object.keys(firstRow)
        return [columnNames, ...raw] as [string[], ...T[]]
      }
    }

    return raw
  }
}

export function createD1Binding(
  client: CloudflareAPIClient,
  databaseId: string,
): D1Database {
  return {
    prepare(query: string): D1PreparedStatement {
      return new D1PreparedStatementImpl(query, client, databaseId) as D1PreparedStatement
    },

    async batch<T = unknown>(statements: D1PreparedStatement[]): Promise<D1Result<T>[]> {
      const endpoint = `/accounts/${client.getAccountId()}/d1/database/${databaseId}/query`

      const queries = statements.map((stmt) => {
        const impl = stmt as unknown as D1PreparedStatementImpl
        return {
          sql: (impl as any).query,
          params: (impl as any).bindings,
        }
      })

      const data = await client.post<D1APIQueryResponse[]>(endpoint, queries)

      return data.map(result => ({
        success: true as const,
        results: result.results as T[],
        meta: {
          served_by: result.meta.served_by || '',
          duration: result.meta.duration || 0,
          changes: result.meta.changes || 0,
          last_row_id: result.meta.last_row_id || 0,
          changed_db: result.meta.changed_db || false,
          size_after: result.meta.size_after || 0,
          rows_read: result.meta.rows_read || 0,
          rows_written: result.meta.rows_written || 0,
        },
      }))
    },

    async exec(query: string): Promise<D1ExecResult> {
      const endpoint = `/accounts/${client.getAccountId()}/d1/database/${databaseId}/query`

      const data = await client.post<D1APIQueryResponse[]>(endpoint, {
        sql: query,
      })

      return {
        count: data.length,
        duration: data.reduce((acc, r) => acc + (r.meta.duration || 0), 0),
      }
    },

    dump(): Promise<ArrayBuffer> {
      throw new Error('D1 dump() is deprecated and not supported')
    },
  } as D1Database
}
