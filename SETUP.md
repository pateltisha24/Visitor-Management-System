# FaceSense — external setup steps

Two things need accounts/keys created outside the codebase. This is the checklist.

## A. Groq key (default AI provider — free tier)

The dashboard's "AI summary" uses the Vercel AI SDK with **BYOK** (bring your own key).
Groq is the zero-cost default.

1. Go to **https://console.groq.com** and sign in.
2. **API Keys → Create API Key**, copy it.
3. On the **server**, set `GROQ_API_KEY=<key>` (and `AI_ENC_SECRET=<any long random string>`
   used to encrypt users' own keys at rest). Locally in `server/.env`; on Vercel in the
   project's Environment Variables.
4. Done — AI summaries now work out of the box. A default model is preset
   (`llama-3.3-70b-versatile`); users can override provider/model/key in **Settings → AI insights**.

### BYOK providers users can choose (each: create a key, paste in Settings)
- **Groq** — https://console.groq.com (free tier)
- **OpenAI** — https://platform.openai.com/api-keys
- **Anthropic** — https://console.anthropic.com
- **OpenRouter** — https://openrouter.ai/keys (one key, many models)

User keys are encrypted (AES-256-GCM) before storage and never returned by the API.

## B. Google OAuth (Sign in with Google)

Recommended flow: **Google Identity Services** button on the client → returns an ID token →
the server verifies it → issues our own JWT (same token the rest of the app already uses).

### Google Cloud Console
1. **https://console.cloud.google.com** → create/select a project.
2. **APIs & Services → OAuth consent screen** → External → fill app name, support email,
   developer email. Add scopes `openid`, `email`, `profile`. Add yourself as a test user while
   in testing.
3. **APIs & Services → Credentials → Create Credentials → OAuth client ID** →
   Application type **Web application**.
4. **Authorized JavaScript origins**: `http://localhost:5173` and your client's Vercel URL.
5. **Authorized redirect URIs**: not needed for the ID-token (GIS button) flow; required only if
   you use the redirect/code flow (e.g. `https://<server>/api/auth/google/callback`).
6. Copy the **Client ID** (and **Client Secret** if using the code flow).

### Env vars
- Client: `VITE_GOOGLE_CLIENT_ID=<client-id>` (used to render the Google button).
- Server: `GOOGLE_CLIENT_ID=<client-id>` (used to verify the ID token).

### Server endpoint to add (outline)
`POST /api/auth/google` — body `{ credential }` (the ID token):
1. Verify the token with `google-auth-library` (`new OAuth2Client(GOOGLE_CLIENT_ID).verifyIdToken(...)`).
2. Read `email`, `name` from the payload.
3. Find or create a user by email (no password for Google accounts).
4. Return `{ token: user.generateToken(), userID }` — the client stores it exactly like
   email/password login (`storeTokenInLS`).

### Client
- `npm i @react-oauth/google`, wrap the app in `<GoogleOAuthProvider clientId={VITE_GOOGLE_CLIENT_ID}>`,
  drop a `<GoogleLogin onSuccess={cred => POST /api/auth/google}>` button on the Login/Register pages.

> The rest of the app already uses JWT-in-localStorage, so Google login slots in without changes
> to `ProtectedRoute` or the API client.
