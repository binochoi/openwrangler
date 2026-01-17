import type { Nitro } from 'nitropack'
import type { Nuxt } from 'nuxt/schema'
import { promises as fs } from 'node:fs'
import { relative, resolve } from 'node:path'
import { consola } from 'consola'
import { colorize } from 'consola/utils'
import { fileURLToPath } from 'mlly'
import { findFile } from 'pkg-types'

export {} from './types'

export interface RemoteBinding {
  type: 'r2' | 'kv' | 'd1'
  name: string
  bucketName?: string
  databaseId?: string
  namespaceId?: string
}

export interface CloudflareDevOptions {
  configPath?: string
  environment?: string
  persistDir?: string
  silent?: boolean
  remote?: boolean
  remoteCredentials?: {
    accountId?: string
    apiToken?: string
    r2?: {
      accessKeyId: string
      secretAccessKey: string
    }
  }
}

declare module 'nitropack' {
  interface NitroOptions {
    cloudflareDev?: CloudflareDevOptions
  }
}

function parseTomlBindings(content: string, key: string): Array<Record<string, string | boolean>> {
  const results: Array<Record<string, string | boolean>> = []

  // Match inline array format: key = [ { ... }, { ... } ]
  const inlineMatch = content.match(new RegExp(`${key}\\s*=\\s*\\[([\\s\\S]*?)\\](?=\\n[a-z_]|\\n*$)`, 'i'))
  if (inlineMatch) {
    const arrayContent = inlineMatch[1]
    // Match each { ... } block
    const objectMatches = arrayContent.match(/\{[^}]+\}/g)
    if (objectMatches) {
      for (const obj of objectMatches) {
        const item: Record<string, string | boolean> = {}
        // Extract key = "value" or key = value
        const pairs = obj.match(/(\w+)\s*=\s*(?:"([^"]+)"|'([^']+)'|(\w+))/g)
        if (pairs) {
          for (const pair of pairs) {
            const match = pair.match(/(\w+)\s*=\s*(?:"([^"]+)"|'([^']+)'|(\w+))/)
            if (match) {
              const k = match[1]
              const v = match[2] || match[3] || match[4]
              item[k] = v === 'true' ? true : (v === 'false' ? false : v)
            }
          }
        }
        results.push(item)
      }
    }
  }

  // Match block format: [[key]]
  const blockRegex = new RegExp(`\\[\\[${key}\\]\\]([\\s\\S]*?)(?=\\[\\[|$)`, 'g')
  let blockMatch
  while ((blockMatch = blockRegex.exec(content)) !== null) {
    const block = blockMatch[1]
    const item: Record<string, string | boolean> = {}
    const lines = block.split('\n')
    for (const line of lines) {
      const match = line.match(/^(\w+)\s*=\s*(?:"([^"]+)"|'([^']+)'|(\w+))/)
      if (match) {
        const k = match[1]
        const v = match[2] || match[3] || match[4]
        item[k] = v === 'true' ? true : (v === 'false' ? false : v)
      }
    }
    if (Object.keys(item).length > 0) {
      results.push(item)
    }
  }

  return results
}

async function parseWranglerConfig(configPath: string): Promise<RemoteBinding[]> {
  const remoteBindings: RemoteBinding[] = []
  const content = await fs.readFile(configPath, 'utf8')

  if (configPath.endsWith('.toml')) {
    // Parse R2 buckets
    const r2Bindings = parseTomlBindings(content, 'r2_buckets')
    for (const item of r2Bindings) {
      if (typeof item.binding === 'string') {
        remoteBindings.push({
          type: 'r2',
          name: item.binding,
          bucketName: typeof item.bucket_name === 'string' ? item.bucket_name : undefined,
        })
      }
    }

    // Parse KV namespaces
    const kvBindings = parseTomlBindings(content, 'kv_namespaces')
    for (const item of kvBindings) {
      if (typeof item.binding === 'string') {
        remoteBindings.push({
          type: 'kv',
          name: item.binding,
          namespaceId: typeof item.id === 'string' ? item.id : undefined,
        })
      }
    }

    // Parse D1 databases
    const d1Bindings = parseTomlBindings(content, 'd1_databases')
    for (const item of d1Bindings) {
      if (typeof item.binding === 'string') {
        remoteBindings.push({
          type: 'd1',
          name: item.binding,
          databaseId: typeof item.database_id === 'string' ? item.database_id : undefined,
        })
      }
    }
  }
  else {
    // Parse JSON/JSONC
    const jsonContent = content.replace(/\/\*[\s\S]*?\*\/|\/\/.*/g, '') // Remove comments
    const config = JSON.parse(jsonContent)

    if (config.r2_buckets) {
      for (const bucket of config.r2_buckets) {
        if (bucket.binding) {
          remoteBindings.push({
            type: 'r2',
            name: bucket.binding,
            bucketName: bucket.bucket_name,
          })
        }
      }
    }

    if (config.kv_namespaces) {
      for (const kv of config.kv_namespaces) {
        if (kv.binding) {
          remoteBindings.push({
            type: 'kv',
            name: kv.binding,
            namespaceId: kv.id,
          })
        }
      }
    }

    if (config.d1_databases) {
      for (const d1 of config.d1_databases) {
        if (d1.binding) {
          remoteBindings.push({
            type: 'd1',
            name: d1.binding,
            databaseId: d1.database_id,
          })
        }
      }
    }
  }

  return remoteBindings
}

async function nitroModule(nitro: Nitro) {
  if (!nitro.options.dev) {
    return // Production doesn't need this
  }

  // Find wrangler.json > wrangler.jsonc > wrangler.toml
  let configPath = nitro.options.cloudflareDev?.configPath
  if (!configPath) {
    configPath = await findFile(
      ['wrangler.json', 'wrangler.jsonc', 'wrangler.toml'],
      {
        startingFrom: nitro.options.srcDir,
      },
    ).catch(() => undefined)
  }

  // Parse remote bindings from wrangler config
  let remoteBindings: RemoteBinding[] = []
  if (configPath) {
    remoteBindings = await parseWranglerConfig(configPath).catch(() => [])
  }

  // Resolve the persist dir
  const persistDir = resolve(
    nitro.options.rootDir,
    nitro.options.cloudflareDev?.persistDir || '.wrangler/state/v3',
  )

  // Add `.wrangler/state/v3` to `.gitignore`
  const gitIgnorePath = await findFile('.gitignore', {
    startingFrom: nitro.options.rootDir,
  }).catch(() => undefined)

  let addedToGitIgnore = false
  if (gitIgnorePath && persistDir === '.wrangler/state/v3') {
    const gitIgnore = await fs.readFile(gitIgnorePath, 'utf8')
    if (!gitIgnore.includes('.wrangler/state/v3')) {
      await fs
        .writeFile(gitIgnorePath, `${gitIgnore}\n.wrangler/state/v3\n`)
        .catch(() => {})
      addedToGitIgnore = true
    }
  }

  if (!nitro.options.cloudflareDev?.silent) {
    const remoteInfo = remoteBindings.length > 0
      ? `\nRemote bindings: ${remoteBindings.map(b => `${b.name} (${b.type})`).join(', ')}`
      : ''
    consola.box(
      [
        '🔥 Cloudflare context bindings enabled for dev server',
        '',
        `Config path: \`${configPath ? relative('.', configPath) : colorize('yellow', 'cannot find `wrangler.json`, `wrangler.jsonc`, or `wrangler.toml`')}\``,
        `Persist dir: \`${relative('.', persistDir)}\` ${addedToGitIgnore ? colorize('green', '(added to `.gitignore`)') : ''}`,
        remoteInfo,
      ].join('\n'),
    )
  }

  // Share config to the runtime
  nitro.options.runtimeConfig.wrangler = {
    ...nitro.options.runtimeConfig.wrangler,
    configPath,
    persistDir,
    environment: nitro.options.cloudflareDev?.environment,
    remote: nitro.options.cloudflareDev?.remote ?? false,
    remoteBindings,
    remoteCredentials: nitro.options.cloudflareDev?.remoteCredentials,
  }

  // Make sure runtime is transpiled
  nitro.options.externals.inline = nitro.options.externals.inline || []
  nitro.options.externals.inline.push(
    fileURLToPath(new URL('runtime/', import.meta.url)),
  )

  // Add plugin to inject bindings to dev server
  nitro.options.plugins = nitro.options.plugins || []
  nitro.options.plugins.push(
    fileURLToPath(new URL('runtime/plugin.dev', import.meta.url)),
  )
}

// Dual compatibility with Nuxt and Nitro Modules
export default function nitroCloudflareDev(arg1: unknown, arg2: unknown) {
  if ((arg2 as Nuxt)?.options?.nitro) {
    (arg2 as Nuxt).hooks.hookOnce('nitro:config', (nitroConfig) => {
      nitroConfig.modules = nitroConfig.modules || []
      nitroConfig.modules.push(nitroModule)
    })
  }
  else {
    nitroModule(arg1 as Nitro)
  }
}
