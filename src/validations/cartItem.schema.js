import { z } from "zod";

export const cartListingIdSchema = z.object({
  listingId: z.uuid(),
});
