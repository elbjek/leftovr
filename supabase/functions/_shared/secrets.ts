/**
 * Compares a caller-supplied secret against the expected one without leaking
 * where the first difference is through timing. Length difference is not
 * hidden (it leaks only the length, which is not the secret).
 */
export function secretsMatch(provided: string | null | undefined, expected: string | null | undefined) {
  if (!provided || !expected) return false;
  const a = new TextEncoder().encode(provided);
  const b = new TextEncoder().encode(expected);
  let diff = a.length ^ b.length;
  for (let i = 0; i < Math.max(a.length, b.length); i += 1) {
    diff |= (a[i] ?? 0) ^ (b[i] ?? 0);
  }
  return diff === 0;
}
