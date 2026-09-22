# Play Store assets

Everything here is for the store listing. Nothing in this folder is served by
the app or bundled into the build.

## What is ready

| File | Play field | Spec |
| --- | --- | --- |
| `../public/icons/icon-512.png` | App icon | 512×512 PNG |
| `feature-graphic.png` | Feature graphic | 1024×500 PNG |
| `screenshots/en-*.png` | Phone screenshots, English | 1080×1920 |
| `screenshots/he-*.png` | Phone screenshots, Hebrew | 1080×1920 |
| `listing-en.md` / `listing-he.md` | Title, short and full description | — |
| `twa-manifest.json` | Bubblewrap input | — |
| `screenshots.mjs` | — | recaptures the screenshots above |

The screenshots are real captures of the deployed app on a 360×640 viewport at
3× density, taken against production with an account that holds a position —
not mockups. Recapture them with `screenshots.mjs` after any visual change, or
the listing will show an app that no longer exists.

## Building the APK

Two things must be true first, and neither can be done from this repository:

1. The app exists in Play Console, so Play App Signing has generated a key.
2. `public/.well-known/assetlinks.json` carries that key's **SHA-256
   fingerprint** — the *app signing key*, not the upload key — and has been
   deployed.

Then:

```bash
npm install -g @bubblewrap/cli
bubblewrap init --manifest=https://invest-pal.vercel.app/manifest.webmanifest
# or, to use the committed configuration:
cp store/twa-manifest.json ./twa-manifest.json && bubblewrap build
```

`bubblewrap build` produces `app-release-bundle.aab` for the store and
`app-release-signed.apk` for sideloading. Upload the **.aab**.

## Before submitting

- **Category: Education.** It is a teaching tool with imaginary money, which is
  both true and the lower-friction claim for a finance-adjacent app.
- **Privacy policy URL:** `https://invest-pal.vercel.app/privacy`
- **Data safety:** email, display name, experience level and the virtual
  portfolio. No analytics, no advertising, no location, no third-party sharing,
  no payments. The privacy page is written from an audit of the schema, so it
  and the form should agree.
- **Contact email:** set `VITE_CONTACT_EMAIL` in Vercel so the privacy page
  shows the same address the listing does.
