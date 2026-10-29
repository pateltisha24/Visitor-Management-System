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

// Clock times the way the dashboard writes them: "12–1 pm", "11 am–12 pm".
const ampm = (h) => (h % 24 < 12 ? "am" : "pm");
const clock = (h) => (h % 12 === 0 ? 12 : h % 12);
const hourSpan = (hour) => {
    const h = Number(hour), next = h + 1;
    return ampm(h) === ampm(next)
        ? `${clock(h)}–${clock(next)} ${ampm(next)}`
        : `${clock(h)} ${ampm(h)}–${clock(next)} ${ampm(next)}`;
};

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

const WEEKDAY = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTH = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const round = (n) => Math.round(n);

// The regular week (average visitors by weekday x hour) as plain facts.
function weeklyFacts(weekly) {
    if (!weekly?.rows?.length) return null;
    const slots = [];
    const byDay = weekly.rows.map((r) => {
        r.values.forEach((v, i) => slots.push({ day: r.day, hour: weekly.hours[i], v }));
        return { day: r.day, perDay: r.values.reduce((a, b) => a + b, 0) };
    });
    const sorted = slots.filter((s) => s.v > 0).sort((a, b) => b.v - a.v);
    const open = sorted.filter((s) => s.v >= (sorted[0]?.v || 0) * 0.1);
    const slot = (s) => `${s.day} ${hourSpan(s.hour)} (about ${round(s.v)})`;
    return {
        averageVisitorsByWeekday: byDay.map((d) => `${d.day}: about ${round(d.perDay)}`),
        busiestTimesOfTheWeek: sorted.slice(0, 5).map(slot),
        quietestOpenTimesOfTheWeek: open.slice(-3).reverse().map(slot),
    };
}

// Everything the dashboard shows, as ready-made facts for a question.
function askFacts({ summary, previous, change, daily = [], monthly = [], hourly = [], weekly, now }) {
    const dayLabel = (date) => {
        const d = new Date(`${date}T12:00:00Z`);
        return `${WEEKDAY[d.getUTCDay()]} ${d.getUTCDate()} ${MONTH[d.getUTCMonth()]}`;
    };
    const monthLabel = (m) => `${MONTH[Number(m.slice(5, 7)) - 1]} ${m.slice(0, 4)}`;
    const n = (v) => Math.round(v).toLocaleString("en-US");
    // The day asked about is today (still in progress) or a complete past day.
    const isToday = now?.isToday !== false;
    const weekEarlier = now?.weekday ? (isToday ? `last ${now.weekday}` : `the ${now.weekday} before`) : "a week earlier";
    // Hours that haven't happened yet today aren't "empty", so leave them out.
    const nowHour = isToday && now?.time ? Number(now.time.slice(0, 2)) : 23;
    return {
        dayAskedAbout: now ? (isToday ? `today, ${now.weekday} ${now.date}, ${now.time} (still in progress)`
            : `${now.weekday} ${now.date} (a past day, complete)`) : null,
        theDay: { ...summaryFacts(summary), cameBackLaterSameDay: summary.returning ?? null },
        theDayVsSameTimeAWeekEarlier: change == null ? null : `${change > 0 ? "+" : ""}${change}%`,
        theDayByHourVsAWeekEarlier: hourly.filter((h) => Number(h.hour) <= nowHour && (h.current || h.compare))
            .map((h) => `${hourSpan(h.hour)}${isToday && Number(h.hour) === nowHour ? " (in progress)" : ""}: ${n(h.current || 0)} that day`
                + (h.compare == null ? "" : `, ${n(h.compare)} ${weekEarlier}`)),
        sameWeekdayAWeekEarlierWholeDay: previous?.total ? summaryFacts(previous) : null,
        visitorsPerDayFor30DaysToTheDay: daily.map((d) => `${dayLabel(d.date)}${d.isToday ? (isToday ? " (today, so far)" : " (the day asked about)") : ""}: ${d.count}`),
        visitorsPerMonth: monthly.map((m) => `${monthLabel(m.month)}${m.isCurrent ? " (so far)" : ""}: ${n(m.count)}`
            + (m.days ? ` over ${m.days} days, about ${n(m.count / m.days)} a day` : "")),
        typicalWeekFor4WeeksBefore: weeklyFacts(weekly),
    };
}

function buildAskPrompt(question, facts) {
    return [
        "You answer questions from the owner of a small shop about their visitors, using ONLY the",
        "facts below (counted by an anonymous camera system that never knows who anyone is). Rules:",
        "- If the facts can't answer the question, say so in one sentence and suggest a question",
        "  they can answer (visitor numbers, busy times, age, gender, how people looked, groups, returns).",
        "- Never try to identify or describe a particular person.",
        "- Everyday words a busy shop owner understands. Never say: readings, sentiment, skew,",
        "  distribution, demographic, data, metrics.",
        "- Use the numbers and times exactly as given; don't make up new ones.",
        "- Expressions are estimated from faces, so say people 'seemed' or 'looked' happy.",
        "- The facts are about dayAskedAbout. If it is still in progress, compare it with a week earlier",
        "  ONLY with theDayVsSameTimeAWeekEarlier and the hours so far, never with a whole past day.",
        "- For planning questions (staffing, best or worst days and times), use the typical week.",
        "- Answer first, then one practical suggestion if there's an obvious one.",
        "- At most 80 words. Plain sentences, or up to 4 bullets starting with \"- \". No headings, no bold.",
        "",
        "FACTS:",
        JSON.stringify(facts),
        "",
        "QUESTION:",
        question,
    ].join("\n");
}

// Run a prompt on the user's chosen provider (or the server's Groq key). If
// Groq has retired the model, try the next current one instead of failing.
async function runModel(userId, prompt) {
    const u = await User.findById(userId);
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
        throw Object.assign(new Error("No AI key configured. Add one in Settings, or set GROQ_API_KEY on the server."), { status: 400 });
    }

    const { generateText } = await import("ai");
    const candidates = provider === "groq" ? [model, ...GROQ_FALLBACKS.filter((m) => m !== model)] : [model];
    let lastError;
    for (const candidate of candidates) {
        try {
            const m = await resolveModel(provider, candidate, apiKey);
            const { text } = await generateText({ model: m, prompt, temperature: 0.3 });
            return { text: text.trim(), provider, model: candidate };
        } catch (e) {
            lastError = e;
            const retired = e.statusCode === 404 || /model_not_found|does not exist|decommissioned/i.test(String(e.responseBody || e.message));
            if (!retired) break;
            console.warn(`AI: model ${provider}/${candidate} unavailable, trying the next one`);
        }
    }
    if (lastError?.statusCode === 401) {
        throw Object.assign(new Error(`The ${provider} API key was rejected. Check it in Settings (or GROQ_API_KEY on the server).`), { status: 401 });
    }
    throw Object.assign(new Error(lastError?.message || "AI request failed"), { status: 502 });
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

// POST /api/ai/ask — answer a question about the dashboard's numbers.
const askQuestion = async (req, res) => {
    try {
        if (!req.body.summary.total) return res.status(400).json({ message: "No visitors yet to ask about." });
        const prompt = buildAskPrompt(req.body.question, askFacts(req.body));
        const { text, provider, model } = await runModel(req.userID, prompt);
        res.json({ answer: text, provider, model });
    } catch (e) {
        res.status(e.status || 502).json({ message: e.message || "AI request failed" });
    }
};

module.exports = { getAiConfig, updateAiConfig, askQuestion, summaryFacts, askFacts };
