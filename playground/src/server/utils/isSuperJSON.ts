export function isSuperJSON(obj: unknown): boolean {
  return obj !== null
    && typeof obj === 'object'
    && 'json' in obj
    && 'meta' in obj
    && typeof obj.meta === 'object'
}
