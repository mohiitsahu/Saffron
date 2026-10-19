import Link from "next/link";
export const metadata = { title: "Cancellation and booking changes | Saffron" };
export default function CancellationPage() {
  return <article className="mx-auto max-w-3xl space-y-6 px-4 py-10">
    <h1 className="text-3xl font-bold">Cancellation and booking changes</h1>
    <section><h2 className="text-xl font-bold">Before the meal</h2><p className="mt-2">Customers can withdraw a pending request or cancel an accepted booking before the event time in My bookings. Chefs can decline a pending request or cancel an accepted booking before the event time. The updated status appears in My bookings for both people.</p></section>
    <section><h2 className="text-xl font-bold">Changing the time</h2><p className="mt-2">A chef can suggest a new time for a pending request. The customer must accept it before the booking is confirmed. Declining the new time closes the request. Accepted bookings cannot be rescheduled in place; cancel before the event and send a new request if you both agree.</p></section>
    <section><h2 className="text-xl font-bold">Payments and groceries</h2><p className="mt-2">Saffron does not collect payments or charge cancellation fees. You pay the chef directly. Discuss groceries, preparation costs, and any cancellation arrangements before the chef incurs costs. Saffron cannot automatically refund money paid outside the app.</p></section>
    <section><h2 className="text-xl font-bold">After the event time</h2><p className="mt-2">The app no longer allows cancellation after the event time. Pending requests expire after the requested time passes; if a later suggested time is still outstanding, they stay open until that time passes too. Chefs can mark accepted bookings completed; accepted bookings close automatically 72 hours after the event when the app next checks them.</p></section>
    <section><h2 className="text-xl font-bold">Something went wrong?</h2><p className="mt-2">Use Report a problem on the booking ticket for a no-show, conduct issue, or another concern. An administrator can review the report. Filing a report does not itself cancel a booking or guarantee a refund.</p></section>
    <Link href="/bookings" className="inline-block font-semibold text-leaf underline">Go to My bookings</Link>
  </article>;
}
