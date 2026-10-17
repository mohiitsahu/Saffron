import { z } from "zod";

const ratingMessage = "Choose a rating from 1 to 5 stars.";

export const reviewCreateSchema = z.object({
  bookingId: z.string().trim().min(1, "Missing booking."),
  rating: z.coerce.number().int(ratingMessage).min(1, ratingMessage).max(5, ratingMessage),
  comment: z.string().trim().max(1000, "Comment must be 1000 characters or fewer.").default(""),
});