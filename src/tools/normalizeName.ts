import { z } from "zod";

import { normalizeCompanyName } from "../utils/string.js";

export const normalizeCompanyNameInputSchema = z.object({
  name: z.string().min(1),
});

export type NormalizeCompanyNameInput = z.infer<typeof normalizeCompanyNameInputSchema>;

export function normalizeCompanyNameTool(input: NormalizeCompanyNameInput) {
  return normalizeCompanyName(input.name);
}
