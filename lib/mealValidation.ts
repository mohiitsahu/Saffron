import { z } from "zod";
import { MAX_MEAL_PHOTOS } from "@/lib/meals";
export const mealDetailsSchema = z.object({
  dishName: z.string().trim().max(80, "Use 80 characters or fewer for the dish name.").default(""),
  caption: z.string().trim().max(280, "Use 280 characters or fewer for the caption.").default(""),
}).strict();
export const mealOrderSchema = z.object({ ids: z.array(z.string().min(1).max(40)).max(MAX_MEAL_PHOTOS) }).strict();
