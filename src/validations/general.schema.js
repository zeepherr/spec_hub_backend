import { z } from "zod";
export const paramId = z.object({
  id: z.coerce
    .number({
      error: "ID must be a valid number",
    })
    .int("ID must be an integer")
    .positive("Invalid motor brand ID"),
});
