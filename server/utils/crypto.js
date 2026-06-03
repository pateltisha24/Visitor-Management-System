const crypto = require("crypto");

// AES-256-GCM encryption for storing third-party API keys at rest.
// Key is derived from AI_ENC_SECRET (fall back to JWT secret in dev).
const SECRET = process.env.AI_ENC_SECRET || process.env.JWT_SECRET_KEY || "dev-insecure-secret-change-me";
const KEY = crypto.createHash("sha256").update(SECRET).digest(); // 32 bytes

function encrypt(plain) {
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv("aes-256-gcm", KEY, iv);
    const enc = Buffer.concat([cipher.update(String(plain), "utf8"), cipher.final()]);
    const tag = cipher.getAuthTag();
    return Buffer.concat([iv, tag, enc]).toString("base64");
}

function decrypt(b64) {
    const data = Buffer.from(b64, "base64");
    const iv = data.subarray(0, 12);
    const tag = data.subarray(12, 28);
    const enc = data.subarray(28);
    const decipher = crypto.createDecipheriv("aes-256-gcm", KEY, iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(enc), decipher.final()]).toString("utf8");
}

module.exports = { encrypt, decrypt };
