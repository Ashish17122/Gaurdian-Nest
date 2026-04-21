# Build GuardianNest as a standalone APK (no Expo Go needed)

This guide produces a **real, installable `.apk`** for Android that runs independently — no Expo Go, no dev server, no Metro bundler needed. The app bundles its JavaScript inside the APK.

> **Time:** ~10–15 minutes on first build (Expo's cloud), 2 min on subsequent builds.
> **Cost:** Free on Expo's free tier (you get 30 free builds/month).
> **Only needs:** a computer with Node.js 18+ and an Expo account (free signup).

---

## TL;DR — 4 commands

```bash
cd /path/to/this/repo/frontend
npm install -g eas-cli
eas login              # sign in with your free Expo account
eas build -p android --profile preview
```

When the build finishes (cloud logs stream to your terminal) you get a URL. Open it → tap **Download** → install the APK on any Android phone.

---

## Step-by-step (detailed)

### 1. Prerequisites on your machine
* Node.js 18 or later (`node -v` should print v18+)
* An Android phone to install on, **or** an Android emulator
* A free Expo account: https://expo.dev/signup (takes 30 seconds)

### 2. Pull the repo to your machine
Copy the whole project (or just the `frontend/` folder + `backend/` folder) to your local computer. The APK will be built from `frontend/`.

### 3. Install the EAS CLI (globally, once)
```bash
npm install -g eas-cli
```

### 4. Log in
```bash
eas login
```
It asks for your Expo username & password (or opens a browser).

### 5. Link this project to your Expo account
From inside the `frontend/` folder:
```bash
cd frontend
eas init
```
This creates an Expo **project id** and writes it into `app.json → extra.eas.projectId`. Do this once per machine.

### 6. Build the APK
```bash
eas build -p android --profile preview
```

What happens:
* Your code is uploaded to Expo's cloud.
* A fresh Android build container is spun up.
* Gradle builds a **release APK**.
* After 10–15 minutes you see something like:
  ```
  ✔ Build finished
  🤖 Android app:
     https://expo.dev/artifacts/eas/xxxxxxxxx.apk
  ```
* That link downloads the APK. Host it anywhere (Google Drive, GitHub Releases, Netlify, your portfolio site).

### 7. Install on your phone
1. Open the URL on your phone's browser.
2. Tap the downloaded `.apk`.
3. Android will say "unknown source" — tap **Install anyway**.
4. Done. The icon appears in your launcher as **GuardianNest**. Tap it — the app runs **fully standalone**.

---

## Which backend does the installed APK talk to?

The APK has the backend URL **baked in at build time** (see `eas.json → build.preview.env.EXPO_PUBLIC_BACKEND_URL`).

**Current value:** `https://kidtrack-premium.preview.emergentagent.com`

This works as long as the Emergent preview pod is alive. When you're ready to ship permanently:

1. Deploy the backend somewhere permanent (Emergent Deploy, Railway, Fly.io, Render — anywhere that gives you an HTTPS URL).
2. Edit `eas.json` and replace the URL in all three profiles (`development`, `preview`, `production`).
3. Rebuild: `eas build -p android --profile preview`.

---

## Build profiles explained (in `eas.json`)

| Profile       | Output        | Use when                                                                 |
|---------------|---------------|--------------------------------------------------------------------------|
| `development` | APK + dev client | You want to iterate fast (code changes hot-reload over Wi-Fi into the APK). **Still standalone — does NOT need Expo Go.** |
| `preview`     | APK (release) | You want a single file to share with testers / show on a portfolio.       |
| `production`  | AAB           | Uploading to Google Play Store.                                          |

---

## Alternative: build locally (no cloud)

Only if you have Android Studio + Android SDK installed. Much slower to set up but fully offline:

```bash
cd frontend
npx expo prebuild --platform android --clean
cd android
./gradlew assembleRelease
# APK lands in android/app/build/outputs/apk/release/app-release.apk
```

If `./gradlew` complains about a missing SDK, open Android Studio once, accept the licenses, then retry.

---

## Troubleshooting

| Symptom                                         | Fix                                                                                                        |
|-------------------------------------------------|------------------------------------------------------------------------------------------------------------|
| `eas: command not found`                        | `npm install -g eas-cli` again, or use `npx eas-cli …` instead of `eas …`                                  |
| Build fails: *project id missing*               | Run `eas init` inside `frontend/` (or just run `eas build` — it offers to create one)                      |
| App installs but crashes on splash              | Open `adb logcat \| grep ReactNative` — usually means wrong `EXPO_PUBLIC_BACKEND_URL` or backend is down.   |
| "App not installed" on phone                    | Uninstall any previous GuardianNest first. The signing key changed.                                        |
| Google sign-in button doesn't work on native    | Expected for now — Emergent Auth is web-only. Use "Demo Login" on the APK.                                  |

---

## Portfolio checklist

- [ ] Pick a hosting spot for the `.apk` (GitHub Releases is free and looks pro).
- [ ] Add a "Download APK" button on your portfolio that links to it.
- [ ] Include a 30-second screen recording of the app running (QuickTime or Android Studio).
- [ ] Mention the tech stack: *Expo SDK 54 + FastAPI + MongoDB + Razorpay scaffold + runtime feature flags*.
- [ ] Link this repo and the `ROADMAP.md` so recruiters see the architecture.

Happy shipping 🚀
