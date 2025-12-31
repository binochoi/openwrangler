import { relative, resolve } from "node:path";
import { promises as fs } from "node:fs";
import { fileURLToPath } from "mlly";
import type { Nitro } from "nitropack";
import type { Nuxt } from "nuxt/schema";
import { consola } from "consola";
import { colorize } from "consola/utils";
import { findFile } from "pkg-types";

export {} from "./types";

export interface RemoteBinding {
  type: "r2" | "kv" | "d1";
  name: string;
  bucketName?: string;
  databaseId?: string;
  namespaceId?: string;
}

export interface CloudflareDevOptions {
  configPath?: string;
  environment?: string;
  persistDir?: string;
  silent?: boolean;
  remote?: {
    accountId?: string;
    apiToken?: string;
  };
}

declare module "nitropack" {
  interface NitroOptions {
    cloudflareDev?: CloudflareDevOptions;
  }
}

async function parseWranglerConfig(configPath: string): Promise<RemoteBinding[]> {
  const remoteBindings: RemoteBinding[] = [];
  const content = await fs.readFile(configPath, "utf8");

  if (configPath.endsWith(".toml")) {
    // Parse TOML - simple regex-based parsing for remote = true
    const r2Match = content.match(/\[\[r2_buckets\]\]([\s\S]*?)(?=\[\[|$)/g);
    if (r2Match) {
      for (const block of r2Match) {
        if (/remote\s*=\s*true/.test(block)) {
          const bindingMatch = block.match(/binding\s*=\s*"([^"]+)"/);
          const bucketMatch = block.match(/bucket_name\s*=\s*"([^"]+)"/);
          if (bindingMatch) {
            remoteBindings.push({
              type: "r2",
              name: bindingMatch[1],
              bucketName: bucketMatch?.[1],
            });
          }
        }
      }
    }

    const kvMatch = content.match(/\[\[kv_namespaces\]\]([\s\S]*?)(?=\[\[|$)/g);
    if (kvMatch) {
      for (const block of kvMatch) {
        if (/remote\s*=\s*true/.test(block)) {
          const bindingMatch = block.match(/binding\s*=\s*"([^"]+)"/);
          const idMatch = block.match(/id\s*=\s*"([^"]+)"/);
          if (bindingMatch) {
            remoteBindings.push({
              type: "kv",
              name: bindingMatch[1],
              namespaceId: idMatch?.[1],
            });
          }
        }
      }
    }

    const d1Match = content.match(/\[\[d1_databases\]\]([\s\S]*?)(?=\[\[|$)/g);
    if (d1Match) {
      for (const block of d1Match) {
        if (/remote\s*=\s*true/.test(block)) {
          const bindingMatch = block.match(/binding\s*=\s*"([^"]+)"/);
          const idMatch = block.match(/database_id\s*=\s*"([^"]+)"/);
          if (bindingMatch) {
            remoteBindings.push({
              type: "d1",
              name: bindingMatch[1],
              databaseId: idMatch?.[1],
            });
          }
        }
      }
    }
  } else {
    // Parse JSON/JSONC
    const jsonContent = content.replace(/\/\*[\s\S]*?\*\/|\/\/.*/g, ""); // Remove comments
    const config = JSON.parse(jsonContent);

    if (config.r2_buckets) {
      for (const bucket of config.r2_buckets) {
        if (bucket.remote === true) {
          remoteBindings.push({
            type: "r2",
            name: bucket.binding,
            bucketName: bucket.bucket_name,
          });
        }
      }
    }

    if (config.kv_namespaces) {
      for (const kv of config.kv_namespaces) {
        if (kv.remote === true) {
          remoteBindings.push({
            type: "kv",
            name: kv.binding,
            namespaceId: kv.id,
          });
        }
      }
    }

    if (config.d1_databases) {
      for (const d1 of config.d1_databases) {
        if (d1.remote === true) {
          remoteBindings.push({
            type: "d1",
            name: d1.binding,
            databaseId: d1.database_id,
          });
        }
      }
    }
  }

  return remoteBindings;
}

async function nitroModule(nitro: Nitro) {
  if (!nitro.options.dev) {
    return; // Production doesn't need this
  }

  // Find wrangler.json > wrangler.jsonc > wrangler.toml
  let configPath = nitro.options.cloudflareDev?.configPath;
  if (!configPath) {
    configPath = await findFile(
      ["wrangler.json", "wrangler.jsonc", "wrangler.toml"],
      {
        startingFrom: nitro.options.srcDir,
      },
    ).catch(() => undefined);
  }

  // Parse remote bindings from wrangler config
  let remoteBindings: RemoteBinding[] = [];
  if (configPath) {
    remoteBindings = await parseWranglerConfig(configPath).catch(() => []);
  }

  // Resolve the persist dir
  const persistDir = resolve(
    nitro.options.rootDir,
    nitro.options.cloudflareDev?.persistDir || ".wrangler/state/v3",
  );

  // Add `.wrangler/state/v3` to `.gitignore`
  const gitIgnorePath = await findFile(".gitignore", {
    startingFrom: nitro.options.rootDir,
  }).catch(() => undefined);

  let addedToGitIgnore = false;
  if (gitIgnorePath && persistDir === ".wrangler/state/v3") {
    const gitIgnore = await fs.readFile(gitIgnorePath, "utf8");
    if (!gitIgnore.includes(".wrangler/state/v3")) {
      await fs
        .writeFile(gitIgnorePath, gitIgnore + "\n.wrangler/state/v3\n")
        .catch(() => {});
      addedToGitIgnore = true;
    }
  }

  if (!nitro.options.cloudflareDev?.silent) {
    const remoteInfo = remoteBindings.length > 0
      ? `\nRemote bindings: ${remoteBindings.map(b => `${b.name} (${b.type})`).join(", ")}`
      : "";
    consola.box(
      [
        "🔥 Cloudflare context bindings enabled for dev server",
        "",
        `Config path: \`${configPath ? relative(".", configPath) : colorize("yellow", "cannot find `wrangler.json`, `wrangler.jsonc`, or `wrangler.toml`")}\``,
        `Persist dir: \`${relative(".", persistDir)}\` ${addedToGitIgnore ? colorize("green", "(added to `.gitignore`)") : ""}`,
        remoteInfo,
      ].join("\n"),
    );
  }

  // Share config to the runtime
  nitro.options.runtimeConfig.wrangler = {
    ...nitro.options.runtimeConfig.wrangler,
    configPath,
    persistDir,
    environment: nitro.options.cloudflareDev?.environment,
    remoteBindings,
    remoteCredentials: {
      accountId: nitro.options.cloudflareDev?.remote?.accountId || process.env.CF_ACCOUNT_ID,
      apiToken: nitro.options.cloudflareDev?.remote?.apiToken || process.env.CF_API_TOKEN,
    },
  };

  // Make sure runtime is transpiled
  nitro.options.externals.inline = nitro.options.externals.inline || [];
  nitro.options.externals.inline.push(
    fileURLToPath(new URL("runtime/", import.meta.url)),
  );

  // Add plugin to inject bindings to dev server
  nitro.options.plugins = nitro.options.plugins || [];
  nitro.options.plugins.push(
    fileURLToPath(new URL("runtime/plugin.dev", import.meta.url)),
  );
}

// Dual compatibility with Nuxt and Nitro Modules
export default function nitroCloudflareDev(arg1: unknown, arg2: unknown) {
  if ((arg2 as Nuxt)?.options?.nitro) {
    (arg2 as Nuxt).hooks.hookOnce("nitro:config", (nitroConfig) => {
      nitroConfig.modules = nitroConfig.modules || [];
      nitroConfig.modules.push(nitroModule);
    });
  } else {
    nitroModule(arg1 as Nitro);
  }
}
