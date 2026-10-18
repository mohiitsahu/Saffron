import { z } from "zod";

function isHttpUrl(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

// Turns Zod issues into { fieldName: "first message" } for the forms.
export function fieldErrors(issues: readonly { path: readonly PropertyKey[]; message: string }[]) {
  const out: Record<string, string> = {};
  for (const issue of issues) {
    const key = String(issue.path[0] ?? "form");
    if (!out[key]) out[key] = issue.message;
  }
  return out;
}

const phoneSchema = z
  .string()
  .trim()
  .transform((v) => v.replace(/[\s-]/g, "").replace(/^(\+91|91|0)(?=\d{10}$)/, ""))
  .refine((v) => /^[6-9]\d{9}$/.test(v), "Enter a 10-digit Indian mobile number.");

export const chefProfileSchema = z.object({
  displayName: z
    .string()
    .trim()
    .min(2, "Enter your chef name (at least 2 characters).")
    .max(60, "Chef name must be 60 characters or fewer."),
  bio: z
    .string()
    .trim()
    .min(20, "Write a bio of at least 20 characters so customers know you.")
    .max(1000, "Bio must be 1000 characters or fewer."),
  city: z
    .string()
    .trim()
    .min(2, "Enter the city you cook in.")
    .max(60, "City must be 60 characters or fewer."),
  cuisines: z
    .array(z.string().trim().toLowerCase().min(1).max(30, "Each cuisine must be 30 characters or fewer."))
    .min(1, "Add at least one cuisine.")
    .max(8, "Add at most 8 cuisines.")
    .transform((list) => Array.from(new Set(list))),
  pricePerPerson: z.coerce
    .number()
    .int("Price must be a whole number.")
    .min(50, "Price must be at least ₹50 per person.")
    .max(20000, "Price must be ₹20,000 per person or less."),
  maxGuests: z.coerce
    .number()
    .int("Maximum guests must be a whole number.")
    .min(1, "Maximum guests must be at least 1.")
    .max(100, "Maximum guests must be 100 or fewer."),
  yearsExperience: z.coerce
    .number()
    .int("Years of experience must be a whole number.")
    .min(0, "Years of experience cannot be negative.")
    .max(60, "Years of experience must be 60 or fewer."),
  phone: phoneSchema,
  photoUrl: z
    .string()
    .trim()
    .max(500, "Photo link is too long.")
    .default("")
    .refine((v) => v === "" || isHttpUrl(v), "Photo link must start with http:// or https://.")
    .transform((v) => (v === "" ? null : v)),
  sampleMenu: z.string().trim().max(2000, "Sample menu must be 2000 characters or fewer.").default(""),
  active: z.boolean().default(true),
});

export const bookingCreateSchema = z.object({
  chefProfileId: z.string().trim().min(1, "Missing chef."),
  // datetime-local value such as 2026-11-02T19:30, read as Indian Standard Time.
  eventDate: z
    .string()
    .trim()
    .regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/, "Choose a date and time.")
    .transform((v) => new Date(`${v}:00+05:30`))
    .refine((d) => !Number.isNaN(d.getTime()), "Choose a valid date and time."),
  guests: z.coerce
    .number()
    .int("Guests must be a whole number.")
    .min(1, "Enter at least 1 guest.")
    .max(100, "Guests must be 100 or fewer."),
  area: z
    .string()
    .trim()
    .min(2, "Enter your area or neighbourhood.")
    .max(80, "Area must be 80 characters or fewer."),
  address: z
    .string()
    .trim()
    .min(10, "Enter your full address (at least 10 characters).")
    .max(500, "Address must be 500 characters or fewer."),
  phone: phoneSchema,
  notes: z.string().trim().max(1000, "Notes must be 1000 characters or fewer.").default(""),
});

export const bookingActionSchema = z.object({
  action: z.enum(["accept", "cancel", "complete"]),
});

export type ChefProfileInput = z.infer<typeof chefProfileSchema>;