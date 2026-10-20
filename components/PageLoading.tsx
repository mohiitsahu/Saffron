export default function PageLoading({ label = "Loading your page" }: { label?: string }) {
  return (
    <div role="status" aria-live="polite" className="w-full px-4 py-12 sm:px-6 lg:px-8">
      <p className="font-semibold text-leaf">{label}…</p>
      <div aria-hidden="true" className="mt-6 space-y-6 motion-safe:animate-pulse">
        <div className="h-8 w-2/3 max-w-md rounded-lg bg-sage/70" />
        <div className="h-4 w-3/4 max-w-lg rounded bg-sage/50" />
        <div className="grid gap-4 sm:grid-cols-2">
          {[0, 1].map((item) => <div key={item} className="h-56 rounded-2xl border border-leaf/15 bg-sage/30" />)}
        </div>
      </div>
    </div>
  );
}
