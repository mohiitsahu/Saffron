import { z } from "zod";
import { chefProfileSchema } from "@/lib/validation";

export const ACCOUNT_DELETION_REASON = "account_deletion";
export const accountSchema = z.object({
  name: z.string().trim().min(2, "Enter at least 2 characters.").max(80, "Use 80 characters or fewer."),
  phone: z.union([z.literal(""), chefProfileSchema.shape.phone]),
}).strict();

export const deletionSchema = z.object({
  confirmation: z.literal("DELETE"),
}).strict();
