# Hammerbid on Apple platforms

## What works today (no App Store, no Mac)

Hammerbid is an installable web app. On an iPhone:

1. Open the deployed site in **Safari**.
2. Tap **Share → Add to Home Screen**.

It launches full-screen from the home screen with the app icon, dark theme,
and notch/home-indicator safe areas handled. This is free and instant for
every user.

## App Store (.ipa) — the native shell

The `ios/` folder is a ready Capacitor Xcode project. It wraps the deployed
site, so server actions, Supabase auth, and Stripe keep working, and web
deploys update the app without resubmission.

Before building:

1. Replace the placeholder domain in `capacitor.config.ts` (`server.url`)
   with the production Vercel URL.
2. Run `npx cap sync ios` after any config change.

Building requires Apple tooling (not available on Windows):

- **With a Mac**: `npx cap open ios`, then archive/distribute in Xcode.
  CocoaPods/SwiftPM resolve on first open.
- **Without a Mac**: use a cloud macOS build service — Codemagic or Ionic
  Appflow both build Capacitor iOS apps from a Git repo.

Either way you need an **Apple Developer account** ($99/year) for signing
and App Store submission.

Review note: Apple can reject apps that are only a website wrapper
(guideline 4.2). Adding a native touch or two before submission — push
notifications for outbid alerts is the natural one for Hammerbid — greatly
improves approval odds.

## About .dmg / .pkg

Those are **macOS desktop installer** formats — iPhones never use them. iOS
apps ship only as `.ipa` through the App Store (or TestFlight). If a Mac
desktop app is ever wanted, that would be an Electron/Tauri build, also
produced on macOS. For Mac users today, the installable web app (Safari →
Add to Dock on macOS Sonoma+) covers it.
