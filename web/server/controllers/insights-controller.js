const User = require("../models/user-model");
const { encrypt, decrypt } = require("../utils/crypto");

// Sensible default model per provider. Groq is the zero-cost default.
const DEFAULT_MODEL = {
    groq: "llama-3.3-70b-versatile",
    openai: "gpt-4o-mini",
    anthropic: "claude-3-5-haiku-latest",
    openrouter: "meta-llama/llama-3.3-70b-instruct",
};
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

function buildPrompt(summary) {
    const top = (summary.age || []).slice().sort((a, b) => b.count - a.count)[0];
    const facts = {
        total: summary.total,
        gender: summary.gender,
        topAgeGroup: top?.age,
        emotions: summary.emotion,
        individualsVsGroups: summary.gi,
        emotionsByHour: summary.byHour,
    };
    return [
        "You are a retail analytics assistant. Given this JSON of anonymous visitor analytics",
        "(age band, gender and emotion only — no identities), write 3 to 4 short, specific,",
        "plain-English insights a store manager could act on. Mention concrete numbers, the busiest",
        "and happiest times, sentiment, and the demographic skew. No preamble, no markdown headings —",
        "just tight sentences or bullet points.",
        "",
        "DATA:",
        JSON.stringify(facts),
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
        const m = await resolveModel(provider, model, apiKey);
        const { text } = await generateText({ model: m, prompt: buildPrompt(summary), temperature: 0.4 });
        res.json({ insight: text.trim(), provider, model });
    } catch (e) {
        res.status(502).json({ message: e.message || "AI request failed" });
    }
};

module.exports = { getAiConfig, updateAiConfig, generateInsight };
