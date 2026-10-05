# Deploying the Velox API

## What this is
A standard Node.js + Express server (`server.js`). It's not serverless-only
and isn't locked to one platform — anything that can run `npm install &&
npm start` and give you a public URL works: Render, Railway, Fly.io,
a plain VPS, etc. Below are placeholders for the most common free-tier
options; delete the ones you don't use.

The app reads its port from `process.env.PORT` (already wired in
`server.js`), which is how every one of these platforms tells your app
which port to listen on — nothing to change there.

## Before deploying — checklist for whoever hosts this
1. **Firebase project** — create one free at console.firebase.google.com
   (if not already done), enable Firestore + Authentication → Email/Password.
2. **Service account key** — Project Settings → Service Accounts →
   Generate new private key. You'll paste three values from that JSON into
   the host's environment variables (never commit the JSON file itself).
3. **Deploy Firestore rules/indexes once**, from a machine with the
   Firebase CLI installed:
   ```bash
   npm install -g firebase-tools
   firebase login
   firebase use --add        # select the project, give it an alias
   firebase deploy --only firestore:rules,firestore:indexes
   ```

## Environment variables to set on the host
Whatever platform is used, set these (same names as `.env.example`):

| Variable | Value |
|---|---|
| `PORT` | ← usually set automatically by the host — leave unset unless it requires a specific one |
| `CORS_ORIGINS` | ← **PLACEHOLDER: the live frontend URL(s)**, comma-separated, e.g. `https://velox.yourdomain.com` |
| `FIREBASE_PROJECT_ID` | ← PLACEHOLDER: from the service account JSON |
| `FIREBASE_CLIENT_EMAIL` | ← PLACEHOLDER: from the service account JSON |
| `FIREBASE_PRIVATE_KEY` | ← PLACEHOLDER: from the service account JSON (keep the `\n` sequences literal — most hosts handle multi-line secrets fine if pasted as one line with `\n`) |

**Do not** commit a `.env` file or the Firebase service account JSON to git
— `.gitignore` already excludes `.env`.

## Option A — Render (render.yaml included)
`render.yaml` in this repo is a ready-to-use Blueprint. On Render:
"New +" → "Blueprint" → point at this repo → it reads `render.yaml`
automatically. Fill in the env vars flagged `sync: false` in the Render
dashboard (that's the Firebase secrets above). Free tier available.

## Option B — Railway
No config file needed. "New Project" → "Deploy from GitHub repo" → Railway
auto-detects Node.js, runs `npm install` then `npm start`. Add the same
environment variables in Settings → Variables. Free tier available.

## Option C — Fly.io
`Dockerfile` is included for this option (and any other Docker-based host).
```bash
fly launch        # answer prompts, it detects the Dockerfile
fly secrets set FIREBASE_PROJECT_ID=... FIREBASE_CLIENT_EMAIL=... FIREBASE_PRIVATE_KEY=... CORS_ORIGINS=...
fly deploy
```

## Option D — Any Docker host
```bash
docker build -t velox-api .
docker run -p 4000:4000 --env-file .env velox-api
```

## After deploying
1. Note the live API URL the host gives you, e.g. `https://velox-api.onrender.com`.
2. Update `CORS_ORIGINS` to the live **frontend** URL (not the API's own URL).
3. In `public/api-client.js`, update `API_BASE_URL` to the live API URL +
   `/api` (e.g. `https://velox-api.onrender.com/api`) — currently a
   placeholder pointing at `localhost:4000`.
4. Hit `https://<your-api-url>/health` — should return `{"status":"ok"}`.
