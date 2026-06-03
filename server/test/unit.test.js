const { test } = require("node:test");
const assert = require("node:assert");

process.env.AI_ENC_SECRET = "test-secret";

const { encrypt, decrypt } = require("../utils/crypto");
const { contactSchema } = require("../validators/contact-validator");
const { ingestSchema } = require("../validators/ingest-validator");
const { loginSchema, signupSchema } = require("../validators/auth-validator");
const apiKeyMiddleware = require("../middlewares/api-key-middleware");

test("crypto: encrypt/decrypt round-trips", () => {
    const secret = "sk-abc-123";
    const enc = encrypt(secret);
    assert.notStrictEqual(enc, secret);
    assert.strictEqual(decrypt(enc), secret);
});

test("contactSchema: rejects bad email, accepts valid payload", () => {
    assert.strictEqual(contactSchema.safeParse({ username: "A", email: "nope", phone: "123", message: "hi" }).success, false);
    assert.strictEqual(contactSchema.safeParse({ username: "Asha", email: "a@b.com", phone: "12345", message: "hello there" }).success, true);
});

test("ingestSchema: requires Age/Gender/Emotion", () => {
    assert.strictEqual(ingestSchema.safeParse({ Gender: "Female" }).success, false);
    assert.strictEqual(ingestSchema.safeParse({ Age: "(20-30)", Gender: "Female", Emotion: "Happy" }).success, true);
});

test("auth validators: email login + password length", () => {
    assert.strictEqual(loginSchema.safeParse({ email: "a@b.com", password: "12345" }).success, false); // <6
    assert.strictEqual(loginSchema.safeParse({ email: "not-an-email", password: "123456" }).success, false);
    assert.strictEqual(loginSchema.safeParse({ email: "a@b.com", password: "123456" }).success, true);
    assert.strictEqual(signupSchema.safeParse({ organisation: "Acme", email: "a@b.com", password: "123456" }).success, true);
});

test("apiKeyMiddleware: 401 on missing/wrong key, next() on match", () => {
    process.env.INGEST_API_KEY = "secret-key";
    const makeRes = () => {
        const res = { code: null, body: null };
        res.status = (c) => { res.code = c; return res; };
        res.json = (b) => { res.body = b; return res; };
        return res;
    };

    // missing
    let res = makeRes();
    apiKeyMiddleware({ header: () => undefined }, res, () => { res.code = "NEXT"; });
    assert.strictEqual(res.code, 401);

    // wrong
    res = makeRes();
    apiKeyMiddleware({ header: () => "wrong" }, res, () => { res.code = "NEXT"; });
    assert.strictEqual(res.code, 401);

    // correct
    res = makeRes();
    let called = false;
    apiKeyMiddleware({ header: () => "secret-key" }, res, () => { called = true; });
    assert.strictEqual(called, true);
});
