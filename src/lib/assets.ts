function ensureTrailingSlash(value: string): string {
  return value.endsWith('/') ? value : `${value}/`
}

export function assetUrl(path: string): string {
  const normalizedPath = path.startsWith('/') ? path.slice(1) : path
  const base = ensureTrailingSlash(import.meta.env.BASE_URL)
  return `${base}${normalizedPath}`
}
