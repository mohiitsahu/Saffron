"use client";

export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  // Root-layout errors must render their own document; no session or database queries here.
  return <html lang="en"><body style={{ margin: 0, background: "#F7F2E6", color: "#0F332C", fontFamily: "system-ui, sans-serif" }}>
    <main style={{ maxWidth: 560, margin: "64px auto", padding: 24 }}>
      <h1>Saffron is temporarily unavailable</h1>
      <p>Please try again in a moment. If you just sent a request, check your bookings before submitting it again.</p>
      <button type="button" onClick={reset} style={{ padding: "12px 24px", background: "#2A6B5C", color: "white", border: 0, borderRadius: 8, fontSize: 16 }}>Try again</button>
      <p><a href="/">Return home</a></p>
    </main>
  </body></html>;
}
