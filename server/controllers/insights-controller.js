const User = require("../models/user-model");
const { encrypt, decrypt } = require("../utils/crypto");

// Sensible default model per provider. Groq is the zero-cost default.
// Providers retire models regularly (Groq's llama-3.3-70b-versatile went away
// and broke the summary), so Groq also has fallbacks and an env override.
const DEFAULT_MODEL = {
    groq: process.env.AI_GROQ_MODEL || "openai/gpt-oss-120b",
    openai: "gpt-4o-mini",
    anthropic: "claude-haiku-5-5",
    openrouter: "meta-llama/llama-3.3-70b-instruct",
};
const GROQ_FALLBACKS = ["openai/gpt-oss-120b", "openai/gpt-oss-20b", "qwen/qwen3.8-27b"];
const PROVIDERS = Object.keys(DEFAULT_MODEL);

// The AI SDK packages are ESM-only, so we dynamic-import them from this CJS app.
async function resolveModel(provider, model, apiKey) {
    if (provider === "openai") {
        const { createOpenAI } = await import("@ai-sdk/openai");
        return createOpenAI({ apiKey })(model);
    }
    if (provider === "anthropic") {
        const { createAnthropic } = await import("@ai-sdk/anthropic");
        return createAnthropic({ apiKey })(model);
    }
    if (provider === "openrouter") {
        const { createOpenRouter } = await import("@openrouter/ai-sdk-provider");
        return createOpenRouter({ apiKey })(model);
    }
    const { createGroq } = await import("@ai-sdk/groq"); // default
    return createGroq({ apiKey })(model);
}

const hour12 = (h) => {
    const n = Number(h) % 24;
    return `${n % 12 === 0 ? 12 : n % 12} ${n < 12 ? "am" : "pm"}`;
};
const hourSpan = (h) => `${hour12(h)}-${hour12(Number(h) + 1)}`;

// Work the numbers out here so the model only phrases them (left to do its own
// arithmetic on raw counts, it gets them wrong).
function summaryFacts(summary) {
    const total = summary.total || 0;
    const pct = (n) => (total ? Math.round(((n || 0) / total) * 100) : 0);
    const hours = (summary.byHour || [])
        .map((h) => ({ hour: h.hour, visitors: Object.entries(h).reduce((a, [k, v]) => (k === "hour" ? a : a + v), 0) }))
        .filter((h) => h.visitors > 0);
    const byVisitors = [...hours].sort((a, b) => b.visitors - a.visitors);
    // Quietest *open* hour: ignore hours under 10% of the peak (stray detections
    // before opening or after closing).
    const open = byVisitors.filter((h) => h.visitors >= (byVisitors[0]?.visitors || 0) * 0.1);
    const ages = [...(summary.age || [])].sort((a, b) => b.count - a.count);
    const emotion = summary.emotion || {};
    const expressions = Object.entries(emotion).sort((a, b) => b[1] - a[1]).slice(0, 3)
        .map(([name, n]) => `${name} ${pct(n)}%`);
    return {
        totalVisitors: total,
        busiestTimes: byVisitors.slice(0, 3).map((h) => `${hourSpan(h.hour)} (${h.visitors} visitors)`),
        quietestOpenTime: open.length > 3 ? `${hourSpan(open[open.length - 1].hour)} (${open[open.length - 1].visitors} visitors)` : null,
        women: `${pct((summary.gender || {}).Female)}%`,
        men: `${pct((summary.gender || {}).Male)}%`,
        biggestAgeGroups: ages.slice(0, 2).map((a) => `${a.age.replace(/[()]/g, "")} years (${pct(a.count)}%)`),
        cameInGroups: `${pct((summary.gi || {}).group)}%`,
        lookedHappyOrSurprised: `${pct((emotion.Happy || 0) + (emotion.Surprise || 0))}%`,
        mostCommonExpressions: expressions,
    };
}

function buildPrompt(summary) {
    return [
        "You help the owner of a small shop understand their visitors. Using ONLY the facts below,",
        "write 3 or 4 bullet points. Each bullet: one plain observation, then one practical thing",
        "to do about it. Rules:",
        "- Everyday words a busy shop owner understands. Never say: readings, sentiment, skew,",
        "  distribution, demographic, data, metrics.",
        "- Use the numbers and times exactly as given; don't calculate new ones.",
        "- Expressions are estimated from faces, so say people 'seemed' or 'looked' happy.",
        "- At most 30 words per bullet. Start each with \"- \". No headings, no bold, no preamble.",
        "",
        "FACTS:",
        JSON.stringify(summaryFacts(summary)),
    ].join("\n");
}

// GET /api/ai/config — current provider/model + whether a key is stored.
const getAiConfig = async (req, res) => {
    try {
        const u = await User.findById(req.userID);
        const ai = u?.ai || {};
        const provider = ai.provider || "groq";
        res.json({
            provider,
            model: ai.model || DEFAULT_MODEL[provider] || DEFAULT_MODEL.groq,
            hasKey: !!ai.keyEnc,
            defaultAvailable: !!process.env.GROQ_API_KEY,
            providers: PROVIDERS,
            defaults: DEFAULT_MODEL,
        });
    } catch (e) {
        res.status(500).json({ message: e.message });
    }
};

// PATCH /api/ai/config — set provider/model and (optionally) store/clear the key.
const updateAiConfig = async (req, res) => {
    try {
        if (req.user?.email === "demo@facesense.app") {
            return res.status(403).json({ message: "The demo account is read-only" });
        }
        const { provider, model, apiKey } = req.body;
        if (provider && !PROVIDERS.includes(provider)) {
            return res.status(400).json({ message: "Unsupported provider" });
        }
        const updates = {};
        if (provider !== undefined) updates["ai.provider"] = provider;
        if (model !== undefined) updates["ai.model"] = model;
        if (apiKey === "") updates["ai.keyEnc"] = "";          // explicit clear
        else if (apiKey) updates["ai.keyEnc"] = encrypt(apiKey);
        await User.findByIdAndUpdate(req.userID, updates);
        res.json({ message: "AI settings saved" });
    } catch (e) {
        res.status(500).json({ message: e.message });
    }
};

// POST /api/ai/insights — generate a narrative summary from a dashboard summary.
const generateInsight = async (req, res) => {
    try {
        const { summary } = req.body;
        if (!summary || !summary.total) return res.status(400).json({ message: "No data to summarise" });

        const u = await User.findById(req.userID);
        const ai = u?.ai || {};
        let provider = ai.provider || "groq";
        let model = ai.model || DEFAULT_MODEL[provider] || DEFAULT_MODEL.groq;
        let apiKey = ai.keyEnc ? decrypt(ai.keyEnc) : "";

        // Fall back to the server's default Groq key if the user hasn't set one.
        if (!apiKey) {
            provider = "groq";
            model = (ai.provider === "groq" && ai.model) ? ai.model : DEFAULT_MODEL.groq;
            apiKey = process.env.GROQ_API_KEY || "";
        }
        if (!apiKey) {
            return res.status(400).json({ message: "No AI key configured. Add one in Settings, or set GROQ_API_KEY on the server." });
        }

        const { generateText } = await import("ai");
        const prompt = buildPrompt(summary);
        // If Groq has retired the model, try the next current one instead of failing.
        const candidates = provider === "groq" ? [model, ...GROQ_FALLBACKS.filter((m) => m !== model)] : [model];
        let lastError;
        for (const candidate of candidates) {
            try {
                const m = await resolveModel(provider, candidate, apiKey);
                const { text } = await generateText({ model: m, prompt, temperature: 0.4 });
                return res.json({ insight: text.trim(), provider, model: candidate });
            } catch (e) {
                lastError = e;
                const retired = e.statusCode === 404 || /model_not_found|does not exist|decommissioned/i.test(String(e.responseBody || e.message));
                if (!retired) break;
                console.warn(`AI: model ${provider}/${candidate} unavailable, trying the next one`);
            }
        }
        const status = lastError?.statusCode === 401 ? 401 : 502;
        const message = status === 401
            ? `The ${provider} API key was rejected. Check it in Settings (or GROQ_API_KEY on the server).`
            : lastError?.message || "AI request failed";
        res.status(status).json({ message });
    } catch (e) {
        res.status(502).json({ message: e.message || "AI request failed" });
    }
};

module.exports = { getAiConfig, updateAiConfig, generateInsight, buildPrompt, summaryFacts };
