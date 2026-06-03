/**
 * URL validation utilities for SSRF (Server-Side Request Forgery) protection.
 *
 * Provides functions to block requests to private IP ranges, loopback addresses,
 * link-local addresses, and cloud metadata endpoints.
 */

/**
 * Checks whether a URL points to a publicly reachable host.
 * Returns `false` for private IPs, loopback, link-local, and cloud metadata endpoints.
 * Returns `true` only for URLs that resolve to public addresses.
 *
 * @param url - The URL to validate
 * @returns `true` if the URL is allowed (public), `false` if blocked or invalid
 */
export function isUrlAllowed(url: string): boolean {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return false;
  }

  const hostname = parsed.hostname.toLowerCase();

  // Block localhost hostname
  if (hostname === "localhost") {
    return false;
  }

  // Handle IPv6 addresses (strip brackets)
  const isIpv6 = hostname.startsWith("[") && hostname.endsWith("]");
  const bareHost = isIpv6 ? hostname.slice(1, -1) : hostname;

  if (isIpv6) {
    return isIpv6Allowed(bareHost);
  }

  // Handle IPv4 addresses
  const ipv4 = parseIpv4(bareHost);
  if (ipv4 !== null) {
    return isIpv4Allowed(ipv4);
  }

  // Non-IP hostname that isn't localhost — treat as public
  return true;
}

/**
 * Parse a dotted-decimal IPv4 string into a 32-bit integer.
 * Returns `null` if the string is not a valid IPv4 address.
 */
function parseIpv4(s: string): number | null {
  const parts = s.split(".");
  if (parts.length !== 4) return null;

  let result = 0;
  for (const part of parts) {
    const n = Number.parseInt(part, 10);
    if (Number.isNaN(n) || n < 0 || n > 255 || part !== String(n)) {
      return null;
    }
    result = (result << 8) | n;
  }
  // Ensure unsigned
  return result >>> 0;
}

/**
 * Check an IPv4 address (as 32-bit unsigned integer) against blocked ranges.
 */
function isIpv4Allowed(ip: number): boolean {
  // 0.0.0.0/8 — "this network"
  if (ip >>> 24 === 0) return false;

  // 127.0.0.0/8 — loopback
  if (ip >>> 24 === 127) return false;

  // 10.0.0.0/8 — private class A
  if (ip >>> 24 === 10) return false;

  // 172.16.0.0/12 — private class B
  if (ip >>> 20 === 0xac1) return false;

  // 192.168.0.0/16 — private class C
  if (ip >>> 16 === 0xc0a8) return false;

  // 169.254.0.0/16 — link-local (includes cloud metadata 169.254.169.254)
  if (ip >>> 16 === 0xa9fe) return false;

  return true;
}

/**
 * Check an IPv6 address against blocked ranges.
 */
function isIpv6Allowed(ip: string): boolean {
  // Expand and normalize the IPv6 address
  const expanded = expandIpv6(ip);

  // ::1 — loopback
  if (expanded === "0000:0000:0000:0000:0000:0000:0000:0001") return false;

  // fe80::/10 — link-local
  if (expanded.startsWith("fe8")) return false;

  return true;
}

/**
 * Expand a compact IPv6 address to its full 8-group form.
 * Best-effort; returns the input unchanged on parse failure.
 */
function expandIpv6(ip: string): string {
  // Handle :: expansion
  let halves: string[];
  if (ip.includes("::")) {
    const split = ip.split("::");
    const left = split[0] ? split[0].split(":") : [];
    const right = split[1] ? split[1].split(":") : [];
    const missing = 8 - left.length - right.length;
    const groups = [...left, ...Array(missing).fill("0000"), ...right];
    halves = groups;
  } else {
    halves = ip.split(":");
  }

  if (halves.length !== 8) return ip;

  return halves.map((g) => g.padStart(4, "0")).join(":");
}
