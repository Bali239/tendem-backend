import { z } from "zod";

const objectId = z.string().regex(/^[a-f\d]{24}$/i, "Invalid ID");
const conversationSchema = z.object({ userId: objectId });
const messageSchema = z.object({ text: z.string().trim().min(1).max(4000) });
const userSearchSchema = z.object({
  q: z.string().trim().min(1).max(80),
  limit: z.coerce.number().int().min(1).max(20).default(10)
});

export { objectId, conversationSchema, messageSchema, userSearchSchema };
