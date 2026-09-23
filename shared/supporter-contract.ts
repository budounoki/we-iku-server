import { z } from "zod";

export const SUPPORTER_DISPLAY_NAME_DEFAULT = "ぶどうの木";
export const SUPPORTER_KINDS = ["facility", "relative", "sitter"] as const;

export const supporterRecordTypes = [
  "milk",
  "formula",
  "food",
  "diaper",
  "sleep",
  "bath",
  "temp",
  "symptom",
  "medicine",
  "allergy_report",
  "allergy_observation",
  "handoff_note",
] as const;

export type SupporterRecordType = typeof supporterRecordTypes[number];

export const strictUtcIsoSchema = z.string().refine(
  (value) => /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value)
    && !Number.isNaN(Date.parse(value))
    && new Date(value).toISOString() === value,
  "UTC ISO-8601 timestamp is required",
);

const message = z.string().trim().min(1).max(2000);
const optionalMessage = message.optional();
const nonNegativeInteger = z.number().int().min(0).max(100000);

const fieldsByType = {
  milk: z.object({ message: optionalMessage, formulaMl: nonNegativeInteger.optional(), expressedMl: nonNegativeInteger.optional() }).strict()
    .refine((v) => v.formulaMl !== undefined || v.expressedMl !== undefined || v.message !== undefined, "Milk details are required"),
  formula: z.object({ message: optionalMessage, formulaMl: nonNegativeInteger.optional(), expressedMl: nonNegativeInteger.optional() }).strict()
    .refine((v) => v.formulaMl !== undefined || v.expressedMl !== undefined || v.message !== undefined, "Milk details are required"),
  food: z.object({ message: optionalMessage, subType: z.string().trim().min(1).max(100).optional() }).strict(),
  diaper: z.object({ message: optionalMessage, subType: z.string().trim().min(1).max(100).optional() }).strict(),
  sleep: z.object({ message: optionalMessage, durationMin: z.number().int().positive().max(100000), subType: z.string().trim().min(1).max(100).optional() }).strict(),
  bath: z.object({ message: optionalMessage }).strict(),
  temp: z.object({ message: optionalMessage, bodyTemperature: z.number().min(30).max(45).optional() }).strict(),
  symptom: z.object({ message: optionalMessage, subType: z.string().trim().min(1).max(100).optional() }).strict(),
  medicine: z.object({
    message: optionalMessage,
    medicineName: z.string().trim().min(1).max(200).optional(),
    medicineDose: z.string().trim().min(1).max(200).optional(),
  }).strict(),
  allergy_report: z.object({ message }).strict(),
  allergy_observation: z.object({ message }).strict(),
  handoff_note: z.object({ message }).strict(),
} satisfies Record<SupporterRecordType, z.ZodTypeAny>;

export function parseSupporterFields(type: SupporterRecordType, fields: unknown): Record<string, unknown> {
  return fieldsByType[type].parse(fields) as Record<string, unknown>;
}

export const supporterRecordInputSchema = z.object({
  grantId: z.number().int().positive(),
  requestId: z.string().trim().min(8).max(128),
  type: z.enum(supporterRecordTypes),
  occurredAt: strictUtcIsoSchema,
  fields: z.record(z.unknown()),
}).strict().superRefine((value, ctx) => {
  const parsed = fieldsByType[value.type].safeParse(value.fields);
  if (!parsed.success) {
    for (const issue of parsed.error.issues) {
      ctx.addIssue({ ...issue, path: ["fields", ...issue.path] });
    }
  }
});

export const supporterRecordPatchSchema = z.object({
  grantId: z.number().int().positive(),
  requestId: z.string().trim().min(8).max(128),
  occurredAt: strictUtcIsoSchema.optional(),
  fields: z.record(z.unknown()),
  reason: message,
}).strict();

export const supporterInvitationSchema = z.object({
  childId: z.number().int().positive(),
  recipientAddress: z.string().trim().min(1).max(320),
  displayName: z.string().trim().min(1).max(200).optional(),
  startsAt: strictUtcIsoSchema,
  endsAt: strictUtcIsoSchema,
}).strict().refine((value) => value.startsAt < value.endsAt, {
  message: "endsAt must be after startsAt",
  path: ["endsAt"],
});

export const supporterGrantExtensionSchema = z.object({
  endsAt: strictUtcIsoSchema,
}).strict();

export const supporterExportSchema = z.object({
  grantIds: z.array(z.number().int().positive()).min(1).max(100),
}).strict();

export type SupporterRecordDto = {
  id: number | string;
  type: SupporterRecordType;
  createdAt: string;
  message?: string;
  recorderDisplayName: string;
  canEdit: boolean;
  fields: Record<string, string | number | boolean | null>;
};

export type SupporterStatusDto = {
  enabled: boolean;
  authenticated: boolean;
  canManage: boolean;
  isSupporter: boolean;
  displayName?: string;
  message?: string;
};