import { z } from "zod";

export const listingImageParamsSchema = z.object({
  listingId: z.uuid(),
});
