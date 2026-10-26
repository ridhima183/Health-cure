import { z } from "zod";

import type { FeatureField } from "./features.ts";

export function featuresSchema(fields: FeatureField[]) {
  const shape: Record<string, z.ZodType<number>> = {};
  for (const field of fields) {
    const message = `Enter a value between ${field.min} and ${field.max}`;
    shape[field.name] = z
      .number({ error: `Enter ${field.label.toLowerCase()}` })
      .refine((value) => Number.isFinite(value), { message: `Enter ${field.label.toLowerCase()}` })
      .min(field.min, message)
      .max(field.max, message);
  }
  return z.object(shape);
}

export const encounterSchema = z.object({
  patientId: z.string().trim().min(1, "Enter a patient ID"),
  visitLabel: z.string().trim().min(1, "Enter a visit label"),
  notes: z.string().trim().min(1, "Describe symptoms in the notes field."),
});
