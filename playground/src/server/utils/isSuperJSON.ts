export const isSuperJSON = (obj: unknown): boolean => (
  obj !== null
  && typeof obj === 'object'
  && 'json' in obj
  && 'meta' in obj
  && typeof obj.meta === 'object'
)
