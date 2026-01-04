interface CloudflareAPIError {
  code: number
  message: string
}

interface CloudflareAPIResponse<T = unknown> {
  success: boolean
  errors: CloudflareAPIError[]
  messages: string[]
  result: T
}

export class CloudflareAPIClient {
  private readonly baseUrl = 'https://api.cloudflare.com/client/v4'
  private readonly accountId: string
  private readonly apiToken: string

  constructor(accountId: string, apiToken: string) {
    this.accountId = accountId
    this.apiToken = apiToken
  }

  async request<T>(
    method: string,
    endpoint: string,
    body?: unknown,
    headers?: Record<string, string>,
  ): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`

    const response = await fetch(url, {
      method,
      headers: {
        'Authorization': `Bearer ${this.apiToken}`,
        'Content-Type': 'application/json',
        ...headers,
      },
      body: body ? JSON.stringify(body) : undefined,
    })

    const data = await response.json() as CloudflareAPIResponse<T>

    if (!response.ok || !data.success) {
      const errorMessage = data.errors?.[0]?.message || `HTTP ${response.status}`
      throw new Error(`Cloudflare API Error: ${errorMessage}`)
    }

    return data.result
  }

  async get<T>(endpoint: string, headers?: Record<string, string>): Promise<T> {
    return this.request<T>('GET', endpoint, undefined, headers)
  }

  async post<T>(endpoint: string, body?: unknown, headers?: Record<string, string>): Promise<T> {
    return this.request<T>('POST', endpoint, body, headers)
  }

  async put<T>(endpoint: string, body?: unknown, headers?: Record<string, string>): Promise<T> {
    return this.request<T>('PUT', endpoint, body, headers)
  }

  async delete<T>(endpoint: string, body?: unknown, headers?: Record<string, string>): Promise<T> {
    return this.request<T>('DELETE', endpoint, body, headers)
  }

  getAccountId(): string {
    return this.accountId
  }
}
