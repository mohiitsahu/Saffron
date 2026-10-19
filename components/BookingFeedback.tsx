"use client";

import { createContext, useContext, useState } from "react";
import { CheckCircleIcon } from "@/components/Icons";

type Feedback = { title: string; detail: string };
const FeedbackContext = createContext<((feedback: Feedback) => void) | null>(null);

export const useBookingFeedback = () => useContext(FeedbackContext);

export default function BookingFeedback({ children }: { children: React.ReactNode }) {
  const [feedback, setFeedback] = useState<Feedback | null>(null);

  return (
    <FeedbackContext.Provider value={setFeedback}>
      {children}
      {/* This stays mounted when a ticket moves from active bookings to history. */}
      <div className="pointer-events-none fixed inset-x-4 bottom-4 z-50 mx-auto max-w-lg pb-[env(safe-area-inset-bottom)] sm:bottom-6">
        {feedback && (
          <div className="pointer-events-auto flex animate-fade-up items-start gap-3 rounded-2xl border border-leaf/25 bg-forest p-4 text-cream shadow-lift">
            <CheckCircleIcon className="mt-0.5 h-5 w-5 flex-none text-saffron" />
            <div role="status" aria-atomic="true" className="min-w-0 flex-1">
              <p className="font-heading font-bold">{feedback.title}</p>
              <p className="mt-1 text-sm leading-relaxed text-cream/85">{feedback.detail}</p>
            </div>
            <button type="button" onClick={() => setFeedback(null)} aria-label="Dismiss booking update"
              className="-mr-2 -mt-2 flex h-11 w-11 flex-none items-center justify-center rounded-lg text-xl text-cream/80 hover:bg-white/10 focus-visible:outline-cream">
              <span aria-hidden="true">×</span>
            </button>
          </div>
        )}
      </div>
    </FeedbackContext.Provider>
  );
}
