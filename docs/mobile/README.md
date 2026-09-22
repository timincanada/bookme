# BookMe iOS & Android apps

> **Student-only shell (P0):** separate app id `app.bookme.student` ("BookMe Student") under `ios-student/` + `android-student/`. Internal TestFlight / Play testing only — see [`docs/student-app-p0.md`](../student-app-p0.md). This document describes the **coach** app (`app.bookme.training`).

Coach app (`app.bookme.training`, "BookMe"), built with
Capacitor 8. The app loads the live site (`https://bookme.training/welcome`) in a
WebView; `native-shell/index.html` is only the offline page. Web deploys update
the app content; a new store build is needed only for native changes (plugins,
icons, entitlements, versions).

Minimum versions: iOS 15, Android 8.0 (API 26).

## What the apps do differently from the website

- Start at `/welcome`: signed-in coaches → `/app`, signed-in students → `/manage`,
  otherwise a coach/student chooser. Marketing pages redirect to `/welcome`.
- Coach sign-in: email + password only (no Google/X, no Sign in with Apple).
  Students: email code, as on the web.
- iOS: no plan purchase, upgrade, pricing or cancel controls, and no mention of
  buying elsewhere. The "Plan" screen shows status only. On the **US App Store
  storefront only** (native `Storefront` plugin, StoreKit `Storefront.current.countryCode == "USA"`)
  it shows "Manage account on bookme.training", opened in Safari.
  Student lesson payments stay on Stripe.
- Android: same as the web (purchase controls visible). Check Google Play's
  payments policy for coach subscriptions before submitting.
- Account deletion in-app: coach More → Account; student portal → Account.
  Public explanation: `https://bookme.training/delete-account`.
- Push (v1): new message, new booking, cancellation, move request. Texts never
  include message bodies; message pushes follow the 10-minute email cooldown.
- Universal/App Links open `/manage…`, `/s`, `/r/…`, `/app…`, `/welcome` in the app.

## Before the first store build

1. **Apple Team ID** — set `APPLE_TEAM_ID` (10 characters) in the Vercel
   production environment and redeploy.
   `https://bookme.training/.well-known/apple-app-site-association` then returns
   JSON (`application/json`, HTTP 200). It returns 404 until the variable is set.
2. **Android signing SHA-256** — after enrolling in Play App Signing, set
   `ANDROID_CERT_SHA256` to the app-signing certificate fingerprint from Play
   Console (`AA:BB:…`, comma-separate several) and redeploy.
   `https://bookme.training/.well-known/assetlinks.json` then returns the JSON.
3. **Apple capabilities** (developer.apple.com → Identifiers →
   `app.bookme.training`): Push Notifications, Associated Domains.
   `ios/App/App/App.entitlements` already lists `aps-environment` and
   `applinks:bookme.training`.
4. **Database** — migration `0009_mobile_accounts.sql` runs with the normal build
   (`npm run build` → `db:migrate`). Back up first, as for 0006–0008.
5. **Cron** — `/api/cron/reminders` now also purges coach accounts 30 days after
   deletion. Keep it scheduled at least daily, with `CRON_SECRET` set.
6. **Reserved paths** — make sure no coach uses the slug `welcome` or
   `delete-account`: `select id, slug from coaches where slug in ('welcome', 'delete-account');`

## Push credentials (not wired yet)

Sending goes through a transport (`src/lib/bookme/push.ts`, `setPushTransport`).
Until one is installed, pushes are logged as `push_skipped_no_transport` and
nothing is sent; device registration already works.

When the keys are ready, provide:

| Variable | Value |
|---|---|
| `APNS_KEY_ID` | Key ID of the `.p8` APNs auth key |
| `APNS_TEAM_ID` | Apple Team ID |
| `APNS_PRIVATE_KEY` | Contents of the `.p8` file |
| `APNS_BUNDLE_ID` | `app.bookme.training` |
| `APNS_ENV` | `production` (TestFlight/App Store) or `development` |
| `FCM_PROJECT_ID` | Firebase project ID |
| `FCM_SERVICE_ACCOUNT_JSON` | Service-account JSON with FCM send rights |

Android also needs `android/app/google-services.json` from the same Firebase
project (not committed; add it locally or via the CI secret `GOOGLE_SERVICES_JSON`).
Wiring the APNs HTTP/2 + FCM HTTP v1 transport is the next step once these exist.

## Local builds

Prerequisites: Node 22, `npm ci`.

### iOS (Mac with Xcode 16+)

```bash
npm ci
npx cap sync ios
npx cap open ios
```

In Xcode: **App** target → Signing & Capabilities → your team (automatic
signing). Set Version and Build. Product → Archive → Distribute App → App Store
Connect. Test on a real device first (push and universal links behave
differently in the simulator).

### Android (Android Studio, JDK 21)

```bash
npm ci
npx cap sync android
npx cap open android
```

Build → Generate Signed App Bundle → your upload key → `release`, then upload
the `.aab` in Play Console. Command line: `cd android && ./gradlew bundleRelease`,
then sign the bundle with the upload key.

### Icons and splash

Placeholders live in `assets/` (cream paper, forest green, serif "B"). Replace the
files, run `npm run mobile:assets`, then `npx cap sync`. The generator also writes
`icons/` and `public/manifest.webmanifest` — delete both; the site doesn't use them.

## CI (optional)

- `.github/workflows/mobile.yml` — Android release bundle (signed when the
  `ANDROID_KEYSTORE_BASE64`, `ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_ALIAS`,
  `ANDROID_KEY_PASSWORD` secrets exist) and an unsigned iOS compile check.
  Runs on `mobile-v*` tags or manually.
- `codemagic.yaml` — signed iOS build to TestFlight (App Store Connect API key
  integration `bookme_asc`) and signed Android bundle (keystore `bookme_upload`).

## Store listing checklist

- Account deletion URL (Google Play Data safety): `https://bookme.training/delete-account`.
- Privacy policy URL: the site's policy page (currently `/terms`).
- App Review notes: a demo coach login and a demo student email; coach plans are
  managed on the web and the app sells no digital goods; student payments are for
  in-person lessons.
- Screenshots: not produced yet.
