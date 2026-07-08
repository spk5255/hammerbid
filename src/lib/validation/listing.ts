import { z } from "zod";
import {
  MAX_BID_AMOUNT,
  MAX_LISTING_DAYS,
  MIN_LISTING_MINUTES,
  MIN_STARTING_PRICE,
} from "@/lib/constants";

// Money arrives as a string and stays a string (numeric(12,2) in Postgres).
// Range checks with Number() are comparisons only — never float arithmetic (§3.2).
const money = z
  .string()
  .trim()
  .regex(/^\d{1,8}(\.\d{1,2})?$/, "Enter an amount like 25 or 25.50");

export const listingSchema = z.object({
  title: z
    .string()
    .trim()
    .min(3, "Title must be at least 3 characters")
    .max(100, "Title must be at most 100 characters"),
  description: z
    .string()
    .trim()
    .max(2000, "Description must be at most 2000 characters")
    .optional()
    .or(z.literal("")),
  type: z.enum(["product", "service"]),
  category: z.string().trim().max(50).optional().or(z.literal("")),
  starting_price: money
    .refine(
      (v) => Number(v) >= MIN_STARTING_PRICE,
      `Starting price must be at least $${MIN_STARTING_PRICE}.00`
    )
    .refine(
      (v) => Number(v) <= MAX_BID_AMOUNT,
      `Starting price cannot exceed $${MAX_BID_AMOUNT.toLocaleString()} (the per-bid maximum)`
    ),
  min_increment: money
    .refine((v) => Number(v) >= 0.01, "Minimum increment must be at least $0.01")
    .refine((v) => Number(v) <= 1000, "Minimum increment cannot exceed $1,000"),
  buy_now_price: money
    .refine(
      (v) => Number(v) <= MAX_BID_AMOUNT,
      `Buy Now price cannot exceed $${MAX_BID_AMOUNT.toLocaleString()}`
    )
    .optional()
    .or(z.literal("")),
  ends_at: z.coerce
    .date()
    .refine(
      (d) => d.getTime() >= Date.now() + MIN_LISTING_MINUTES * 60_000,
      `End time must be at least ${MIN_LISTING_MINUTES} minutes from now`
    )
    .refine(
      (d) => d.getTime() <= Date.now() + MAX_LISTING_DAYS * 86_400_000,
      `End time can be at most ${MAX_LISTING_DAYS} days from now`
    ),
}).superRefine((data, ctx) => {
  if (
    data.buy_now_price &&
    Number(data.buy_now_price) < Number(data.starting_price)
  ) {
    ctx.addIssue({
      code: "custom",
      path: ["buy_now_price"],
      message: "Buy Now price must be at least the starting price",
    });
  }
});

export type ListingInput = z.infer<typeof listingSchema>;
