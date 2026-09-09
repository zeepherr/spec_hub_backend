import { z } from "zod";

export const webAssetSlotSchema = z.object({
  slot: z.enum(["cover", "promotion", "home", "banner"]),
});
