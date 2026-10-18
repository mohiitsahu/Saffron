// A template is re-mounted on every page change, so each page fades in softly
// instead of snapping into place. Filtering on the same page does not replay it.
export default function Template({ children }: { children: React.ReactNode }) {
  return <div className="animate-page-in">{children}</div>;
}