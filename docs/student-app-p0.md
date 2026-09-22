# BookMe Student app (P0) — internal only

Separate Capacitor shell for the student portal. **TestFlight / Play internal
testing only.** Do **not** submit for App Store or Play review. Apple Developer /
Play Console org may still be pending — do not pay fees or create paid
subscriptions from this workstream.

| | Coach (existing) | Student (this app) |
|---|---|---|
| Config | `capacitor.config.ts` | `capacitor.config.student.ts` |
| App ID | `app.bookme.training` | `app.bookme.student` |
| Display name | BookMe | BookMe Student |
| Native folders | `ios/`, `android/` | `ios-student/`, `android-student/` |
| Offline shell | `native-shell/` | `native-shell-student/` |
| Start URL | `https://bookme.training/welcome` | `https://bookme.training/manage` |
| User-Agent tag | `BookMeApp` | `BookMeStudentApp` |

Web content is the live site; a new native build is only needed for plugins,
icons, entitlements, or version bumps. The web bridge already treats `/manage`
as the student role for device push registration (`src/lib/native/bridge.tsx`).

## Prerequisites

- Node 22, `npm ci`
- **iOS:** Mac with Xcode 16+
- **Android:** Android Studio, JDK 21
- Apple / Google org access when available (not required to sync the project)

## Sync

Capacitor only loads `capacitor.config.ts`, so student commands go through
`scripts/cap-student.mjs`, which swaps in the student config for the duration
of the command and restores the coach config afterward.

```bash
npm ci
npm run mobile:sync:student          # both platforms
# or
node scripts/cap-student.mjs sync ios
node scripts/cap-student.mjs sync android
```

Icons / splash (uses `assets/`; optional brand refresh from
`public/brand/bookme-app-icon.png` before generate):

```bash
npm run mobile:assets:student
```

## Open in Xcode (TestFlight later)

```bash
npm run mobile:ios:student
# equivalent:
#   node scripts/cap-student.mjs sync ios
#   node scripts/cap-student.mjs open ios
```

Or open the project directly:

```text
ios-student/App/App.xcodeproj
```

In Xcode:

1. Select the **App** target → **Signing & Capabilities** → your team
   (automatic signing). Bundle ID must stay `app.bookme.student`.
2. Confirm display name **BookMe Student** (Info → Bundle display name).
3. Capabilities already listed in `App.entitlements`: Push Notifications
   (`aps-environment`), Associated Domains (`applinks:bookme.training`).
   Enable the same on the Apple Developer identifier when the org is ready.
4. Product → Archive → Distribute App → **App Store Connect** → upload for
   **TestFlight / internal testing only**.
5. **Do not** submit for App Store review from this P0 track.

Test on a real device (push and universal links differ in the simulator).

## Open in Android Studio (Play internal testing later)

```bash
npm run mobile:android:student
```

Or open `android-student/`. Build a release bundle for Play **internal testing**
only — do not roll out to production review from this P0 track.

```bash
cd android-student && ./gradlew bundleRelease
```

## First-time regenerate (if folders missing)

Native projects are committed under `ios-student/` and `android-student/`. If
you need to recreate them from scratch:

```bash
rm -rf ios-student android-student
node scripts/cap-student.mjs add ios
node scripts/cap-student.mjs add android
npm run mobile:assets:student
```

## Out of scope (P0)

- App Store / Play **submit for review**
- Paying Apple / Google fees
- Changing student portal product rules
- Enabling `BOOKME_ALLOW_DEMO` or real charges
- Wiring APNs / FCM send transport (same as coach: registration works; send
  is still `push_skipped_no_transport` until keys exist)

When Apple org + `APPLE_TEAM_ID` / AASA are ready, add `app.bookme.student` to
the site association JSON alongside the coach app id. Same for Play
`assetlinks.json` with the student signing cert.
