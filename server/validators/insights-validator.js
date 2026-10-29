const { z } = require("zod");

// What the dashboard sends with a question: the numbers it is already showing.
// Only shapes and sizes are checked; the facts are worked out on the server.
const count = z.number().int().min(0);
const summary = z.object({ total: count }).passthrough();

const askSchema = z.object({
    question: z.string({ required_error: "Type a question" }).trim()
        .min(3, { message: "Type a question" })
        .max(300, { message: "Keep the question under 300 characters" }),
    summary,
    previous: summary.nullable().optional(),
    change: z.number().nullable().optional(),
    daily: z.array(z.object({ date: z.string().max(10), count, isToday: z.boolean().optional() })).max(62).optional(),
    monthly: z.array(z.object({ month: z.string().max(7), count, days: count.optional(), isCurrent: z.boolean().optional() })).max(24).optional(),
    hourly: z.array(z.object({ hour: z.string().max(2), current: z.number().nullable(), compare: z.number().nullable() })).max(24).optional(),
    weekly: z.object({
        hours: z.array(z.string().max(2)).max(24),
        rows: z.array(z.object({ day: z.string().max(3), values: z.array(z.number().min(0)).max(24) })).max(7),
    }).nullable().optional(),
    now: z.object({
        date: z.string().max(10), weekday: z.string().max(12), time: z.string().max(5), isToday: z.boolean().optional(),
    }).optional(),
});

module.exports = { askSchema };
