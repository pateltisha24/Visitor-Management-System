const { z } = require("zod");

const ingestSchema = z.object({
    Age: z.string({ required_error: "Age is required" }).min(1),
    Gender: z.string({ required_error: "Gender is required" }).min(1),
    Emotion: z.string({ required_error: "Emotion is required" }).min(1),
    Gi: z.string().optional(),
    Gi_count: z.number().optional(),
    Date: z.string().optional(),
    Time: z.string().optional(),
    Timestamp: z.string().optional(),
    cameraId: z.string().max(64).regex(/^[a-z0-9][a-z0-9-]*$/i, "cameraId must be letters, digits or dashes").optional(),
    cameraName: z.string().max(80).optional(),
});

// A same-day return visit: when and where only.
const returnSchema = z.object({
    Date: z.string().optional(),
    Time: z.string().optional(),
    Timestamp: z.string().optional(),
    cameraId: ingestSchema.shape.cameraId,
    cameraName: ingestSchema.shape.cameraName,
});

module.exports = { ingestSchema, returnSchema };
