import Link from "next/link";
export default function CancellationNote() {
  return <p className="text-xs leading-relaxed text-ink/70">You can cancel before the event time. Saffron takes no payment or cancellation fee. Agree groceries and other costs with the chef. <Link href="/cancellation" className="font-semibold text-leaf underline underline-offset-2">Cancellation details</Link></p>;
}
