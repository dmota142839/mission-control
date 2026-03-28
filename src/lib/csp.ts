/**
 * SHA-256 (base64) of the inline theme bootstrap in src/app/layout.tsx.
 * Allows that single static script when nonce is missing (e.g. CSP from an
 * outer proxy that does not inject x-nonce for Server Components). If you
 * change the script body, recompute: node -e "require('crypto').createHash('sha256').update(process.argv[1]).digest('base64')" '...script...'
 */
export const THEME_BOOT_INLINE_SCRIPT_SHA256 = 'RVYZvogfrHcnzbCYFcK9fIYAnk+MjdIWMwDAF+B09C4='

export function buildMissionControlCsp(input: { nonce: string; googleEnabled: boolean }): string {
  const { nonce, googleEnabled } = input

  const scriptExtra = googleEnabled ? ' https://accounts.google.com' : ''

  return [
    `default-src 'self'`,
    `base-uri 'self'`,
    `object-src 'none'`,
    `frame-ancestors 'none'`,
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic' 'sha256-${THEME_BOOT_INLINE_SCRIPT_SHA256}' blob:${scriptExtra}`,
    `style-src 'self' 'unsafe-inline'`,
    `style-src-elem 'self' 'unsafe-inline'`,
    `style-src-attr 'unsafe-inline'`,
    `connect-src 'self' ws: wss: http://127.0.0.1:* http://localhost:* https://cdn.jsdelivr.net`,
    `img-src 'self' data: blob:${googleEnabled ? ' https://*.googleusercontent.com https://lh3.googleusercontent.com' : ''}`,
    `font-src 'self' data:`,
    `frame-src 'self'${googleEnabled ? ' https://accounts.google.com' : ''}`,
    `worker-src 'self' blob:`,
  ].join('; ')
}

export function buildNonceRequestHeaders(input: {
  headers: Headers
  nonce: string
  googleEnabled: boolean
}): Headers {
  const requestHeaders = new Headers(input.headers)
  const csp = buildMissionControlCsp({ nonce: input.nonce, googleEnabled: input.googleEnabled })

  requestHeaders.set('x-nonce', input.nonce)
  requestHeaders.set('Content-Security-Policy', csp)

  return requestHeaders
}
