/**
 * Only same-app paths are honoured, so a crafted link like
 * /login?returnUrl=https://evil.example can't bounce a shopper off-site
 * after they sign in.
 */
export function safeReturnUrl(raw: string | null): string {
  return raw && raw.startsWith('/') && !raw.startsWith('//') && !raw.startsWith('/\\') ? raw : '/';
}
