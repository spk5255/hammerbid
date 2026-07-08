import { z } from "zod";

export const usernameSchema = z
  .string()
  .trim()
  .regex(
    /^[A-Za-z0-9_]{3,20}$/,
    "Username must be 3–20 characters: letters, numbers, underscores"
  );

export const signUpSchema = z.object({
  email: z.email("Enter a valid email address"),
  password: z.string().min(8, "Password must be at least 8 characters"),
  username: usernameSchema,
  intent: z.enum(["buy", "sell"]),
});

export const signInSchema = z.object({
  email: z.email("Enter a valid email address"),
  password: z.string().min(1, "Enter your password"),
});
