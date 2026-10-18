"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { inputClass, labelClass, primaryButton } from "@/lib/ui";

export default function ReviewForm({ bookingId }: { bookingId: string }) {
  const router = useRouter();
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (rating === 0) {
      setErrors({ rating: "Choose a rating from 1 to 5 stars." });
      return;
    }

    setSending(true);
    setErrors({});
    setMessage("");

    try {
      const res = await fetch("/api/reviews", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bookingId, rating, comment }),
      });
      const data = await res.json();

      if (!res.ok) {
        setErrors(data.fieldErrors ?? {});
        setMessage(data.error ?? "Could not save your review. Try again.");
        return;
      }
      router.refresh();
    } catch {
      setMessage("Network problem. Check your connection and try again.");
    } finally {
      setSending(false);
    }
  }

  return (
    <form onSubmit={onSubmit} noValidate className="mt-4 space-y-4 border-t-2 border-dashed border-leaf/50 pt-4">
      <h4 className="text-lg font-bold">How was your meal?</h4>

      <fieldset>
        <legend className={labelClass}>Your rating</legend>
        <div className="flex flex-wrap items-center gap-1">
          {[1, 2, 3, 4, 5].map((n) => (
            <label key={n} className="cursor-pointer">
              <input
                type="radio"
                name={`rating-${bookingId}`}
                value={n}
                checked={rating === n}
                onChange={() => setRating(n)}
                className="peer sr-only"
              />
              <span
                aria-hidden="true"
                className={`block min-h-[44px] min-w-[44px] text-center text-3xl leading-[44px] transition-transform duration-150 hover:scale-125 peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 ${
                  n <= rating ? "text-saffron" : "text-ink/30"
                } ${n === rating ? "animate-pop" : ""}`}
              >
                ★
              </span>
              <span className="sr-only">
                {n} {n === 1 ? "star" : "stars"}
              </span>
            </label>
          ))}
          <span className="ml-2 text-sm text-ink/70">{rating ? `${rating} of 5` : "Choose a rating"}</span>
        </div>
        {errors.rating && (
          <p className="mt-1 text-sm font-medium text-danger" role="alert">
            {errors.rating}
          </p>
        )}
      </fieldset>

      <div>
        <label htmlFor={`comment-${bookingId}`} className={labelClass}>
          Comment (optional)
        </label>
        <textarea
          id={`comment-${bookingId}`}
          rows={3}
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          className={inputClass}
        />
        {errors.comment && (
          <p className="mt-1 text-sm font-medium text-danger" role="alert">
            {errors.comment}
          </p>
        )}
      </div>

      {message && (
        <p role="alert" className="animate-fade-in text-sm font-medium text-danger">
          {message}
        </p>
      )}

      <button type="submit" disabled={sending} className={primaryButton}>
        {sending ? "Saving..." : "Submit review"}
      </button>
    </form>
  );
}