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
});

module.exports = { ingestSchema };
