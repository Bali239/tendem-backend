import { z } from "zod";

const updateNameSchema = z.object({
  name: z.string().trim().min(1).max(80)
});

export { updateNameSchema };
