import 'server-only'
import { promises as dns } from 'node:dns'
import net from 'node:net'

function isPrivateV4(ip: string): boolean {
  const p = ip.split('.').map(Number)
  if (p.length !== 4 || p.some((n) => Number.isNaN(n) || n < 0 || n > 255)) return true
  const [a, b] = p
  if (a === 0 || a === 127) return true              // unspecified / loopback
  if (a === 10) return true                           // 10/8
  if (a === 172 && b >= 16 && b <= 31) return true   // 172.16/12
  if (a === 192 && b === 168) return true             // 192.168/16
  if (a === 169 && b === 254) return true             // link-local / AWS metadata
  if (a === 100 && b >= 64 && b <= 127) return true  // CGNAT 100.64/10
  if (a >= 224) return true                           // multicast / reserved
  return false
}

function isPrivateV6(ip: string): boolean {
  const lower = ip.toLowerCase()
  if (lower === '::1' || lower === '::') return true
  if (/^fe[89ab]/.test(lower)) return true           // fe80::/10 link-local
  if (lower.startsWith('fc') || lower.startsWith('fd')) return true  // fc00::/7
  if (lower.startsWith('ff')) return true             // multicast
  const m = lower.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/)
  if (m) return isPrivateV4(m[1])                    // IPv4-mapped
  return false
}

function isUnsafe(ip: string, family: number): boolean {
  return family === 4 ? isPrivateV4(ip) : isPrivateV6(ip)
}

/**
 * Validate a URL is safe to fetch (not pointing to internal/private network).
 * - Only http/https allowed
 * - Resolves both A and AAAA records, rejects if ANY resolves to private range
 * - Fails closed on DNS error
 * - Returns the first safe IPv4 address for pinning (or null if hostname)
 */
export async function assertSafeUrl(urlString: string): Promise<void> {
  let parsed: URL
  try {
    parsed = new URL(urlString)
  } catch {
    throw new Error('Invalid URL')
  }

  if (!['http:', 'https:'].includes(parsed.protocol)) {
    throw new Error('Only HTTP/HTTPS URLs are allowed')
  }

  const hostname = parsed.hostname

  // Bare IP addresses — validate directly
  const ipFamily = net.isIP(hostname)
  if (ipFamily) {
    if (isUnsafe(hostname, ipFamily)) {
      throw new Error('Private IP addresses are not allowed')
    }
    return
  }

  // Hostname — resolve all A and AAAA records, fail closed on any error
  let addrs: { address: string; family: number }[]
  try {
    addrs = await dns.lookup(hostname, { all: true })
  } catch {
    throw new Error('Could not resolve hostname')
  }

  if (!addrs.length) {
    throw new Error('Could not resolve hostname')
  }

  for (const { address, family } of addrs) {
    if (isUnsafe(address, family)) {
      throw new Error('URL resolves to a private address')
    }
  }
}
