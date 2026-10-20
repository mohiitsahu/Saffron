// Return a canonical local path, never an external or protocol-relative redirect.
export function safeSignInCallback(value?: string | string[], siteUrl?: string) {
  const raw = Array.isArray(value) ? value[0] ?? "" : value ?? "";
  if (!raw || raw !== raw.trim() || /[\\\u0000-\u001f\u007f]/.test(raw)) return "/";
  if (!raw.startsWith("/") && !siteUrl) return "/";
  try {
    const base = new URL(siteUrl || "http://localhost:3000");
    const url = new URL(raw, base);
    if (!["http:", "https:"].includes(base.protocol) || url.origin !== base.origin || url.username || url.password) return "/";
    const path = decodeURIComponent(url.pathname);
    // Absolute same-origin URLs can still contain a // pathname. Returning that
    // pathname alone would turn it into an external redirect again.
    if (path.startsWith("//") || /[\\\u0000-\u001f\u007f]/.test(path)) return "/";
    const route = path.toLowerCase();
    if (route.startsWith("/signin") || route.startsWith("/api/auth")) return "/";
    return url.pathname + url.search + url.hash;
  } catch {
    return "/";
  }
}
