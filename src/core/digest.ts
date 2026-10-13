// Canonical JSON plus FNV-1a: diagnostic identity, never a security signature.
export function canonical(value: unknown): string {
  if (Array.isArray(value)) return '[' + value.map(canonical).join(',') + ']';
  if (value !== null && typeof value === 'object') {
    const record = value as Record<string, unknown>;
    return '{' + Object.keys(record).sort().map(key => JSON.stringify(key) + ':' + canonical(record[key])).join(',') + '}';
  }
  return JSON.stringify(value) ?? 'null';
}
export function digest(value: unknown): string {
  let result = 2166136261;
  for (const char of canonical(value)) result = Math.imul(result ^ char.charCodeAt(0), 16777619) >>> 0;
  return result.toString(16).padStart(8, '0');
}
