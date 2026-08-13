# Switching on "Continue with Google"

The app side of Google sign-in is fully built. It stays politely switched off
until it's given a pair of keys from Google — a one-time, ~5 minute setup that
has to be done by a person, in the Google account that should own the app.

## 1. Create the keys

1. Go to <https://console.cloud.google.com/> and pick (or create) a project.
2. **APIs & Services → OAuth consent screen**: set the app name (LUMA),
   support email, and add your users (or publish the app).
3. **APIs & Services → Credentials → Create credentials → OAuth client ID**:
   - Application type: **Web application**
   - Authorized redirect URIs — add one per place the app runs:
     - `http://localhost:3001/api/auth/google/callback`
     - `https://<your-vercel-domain>/api/auth/google/callback`
4. Copy the **Client ID** and **Client secret** it gives you.

## 2. Give them to the app

Locally, add to `.env.local` (never commit these):

```
GOOGLE_CLIENT_ID="...apps.googleusercontent.com"
GOOGLE_CLIENT_SECRET="..."
```

On Vercel, add the same two environment variables in the project settings,
then redeploy.

That's it — the "Continue with Google" button on the sign-in screen starts
working the moment both values are present.

## What it does once on

- Someone who already has an account here (by invitation) and signs in with a
  Google account using the **same email** simply gets in — their account is
  linked to Google from then on, password optional.
- Someone new gets a fresh, empty life map of their own.
- Only Google-verified email addresses are trusted for linking.
