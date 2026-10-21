import { z } from "zod";

const email = z.string().trim().email().max(254).transform((value) => value.toLowerCase());
const password = z.string().min(8).max(128);

const registerSchema = z.object({
  name: z.string().trim().min(1).max(80),
  email,
  password
});

const loginSchema = z.object({ email, password: z.string().min(1).max(128) });
const googleSchema = z.object({ credential: z.string().min(1) });

export { registerSchema, loginSchema, googleSchema };
