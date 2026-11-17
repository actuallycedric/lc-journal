// Vercel Routing Middleware: password gate for the whole site.
// Runs before every request (no matcher = every path, static files included).
// Returning nothing lets the request continue to the static file.

const COOKIE = 'lcj_auth'
const MAX_AGE = 60 * 60 * 24 * 30 // 30 days

async function sha256hex(text) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text))
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

// compares two hex digests without bailing out at the first different char
function sameDigest(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return diff === 0
}

function readCookie(request, name) {
  const header = request.headers.get('cookie') ?? ''
  for (const part of header.split(';')) {
    const [key, ...rest] = part.trim().split('=')
    if (key === name) return rest.join('=')
  }
  return null
}

function redirect(request, path, status = 302, headers = {}) {
  return new Response(null, {
    status,
    headers: { Location: new URL(path, request.url).toString(), 'Cache-Control': 'no-store', ...headers },
  })
}

export default async function middleware(request) {
  const url = new URL(request.url)
  const { JOURNAL_PASSWORD: password, AUTH_SECRET: secret } = process.env

  if (!password || !secret) {
    return new Response('journal is not configured: set JOURNAL_PASSWORD and AUTH_SECRET', {
      status: 500,
      headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' },
    })
  }

  const token = await sha256hex(password + secret)

  if (url.pathname === '/login' && request.method === 'POST') {
    let given = ''
    try {
      const form = await request.formData()
      given = String(form.get('password') ?? '')
    } catch {
      // unreadable body counts as a wrong password
    }
    // hash what was typed the same way, then compare digests
    if (sameDigest(await sha256hex(given + secret), token)) {
      return redirect(request, '/', 303, {
        'Set-Cookie': `${COOKIE}=${token}; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=${MAX_AGE}`,
      })
    }
    // small delay on wrong guesses
    await new Promise((resolve) => setTimeout(resolve, 400))
    return redirect(request, '/login.html?e=1', 303)
  }

  if (url.pathname === '/logout') {
    return redirect(request, '/login.html', 302, {
      'Set-Cookie': `${COOKIE}=; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=0`,
    })
  }

  if (url.pathname === '/login.html' && (request.method === 'GET' || request.method === 'HEAD')) return

  if (sameDigest(readCookie(request, COOKIE), token)) return

  return redirect(request, '/login.html')
}
