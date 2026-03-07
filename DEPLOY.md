# Daily Digest — PWA Deployment Guide

## What's in this package

| File | Purpose |
|---|---|
| `index.html` | The full app (2400 lines, self-contained) |
| `sw.js` | Service Worker — caches everything for instant reload |
| `manifest.json` | Makes it installable as an Android/iOS app |
| `icon-192.png` | App icon (home screen, notifications) |
| `icon-512.png` | App icon (splash screen) |

---

## 🚀 Deploy in 5 minutes — GitHub Pages (FREE, permanent URL)

### Step 1 — Create a GitHub repository
1. Go to https://github.com/new
2. Name it `daily-digest` (or anything you like)
3. Set it to **Public** (required for free GitHub Pages)
4. Click **Create repository**

### Step 2 — Upload the files
1. On your new repo page, click **uploading an existing file**
2. Drag all 5 files (`index.html`, `sw.js`, `manifest.json`, `icon-192.png`, `icon-512.png`) into the upload area
3. Click **Commit changes**

### Step 3 — Enable GitHub Pages
1. Go to **Settings** → **Pages** (left sidebar)
2. Under "Source", select **Deploy from a branch**
3. Choose branch: **main** / folder: **/ (root)**
4. Click **Save**
5. Wait ~1 minute, then your URL appears: `https://YOUR-USERNAME.github.io/daily-digest/`

---

## 📱 Install as Android App (Chrome)

1. Open `https://YOUR-USERNAME.github.io/daily-digest/` in **Chrome on Android**
2. Tap the **three-dot menu** (⋮) in the top right
3. Tap **"Add to Home Screen"** or **"Install App"**
4. Give it a name → **Add**
5. It now appears on your home screen like a native app ✅
   - Opens full-screen (no browser chrome)
   - Works offline (shows cached content)
   - Loads in < 200ms after first visit

## 💻 Install on Desktop (Chrome / Edge)
1. Visit the URL in Chrome or Edge
2. Look for the install icon (⊕) in the address bar
3. Click **Install** → app appears in your taskbar/dock

## 🍎 Install on iOS (Safari)
1. Open the URL in **Safari** (must be Safari, not Chrome)
2. Tap the **Share** button (box with arrow)
3. Tap **"Add to Home Screen"**
4. Tap **Add** → app icon appears on your home screen

---

## ⚡ Performance — what makes it fast

| Feature | Benefit |
|---|---|
| Service Worker | App shell loads from cache in ~50ms |
| localStorage cache | All feed data cached 30 min — instant render on revisit |
| Stale-while-revalidate | Shows cached data immediately, updates silently in background |
| Lazy shelf loading | 24 podcast feed calls deferred until you scroll down |
| Parallel fetches | Events + newspapers fire independently, never block main cards |
| Background sync | Service worker pre-fetches weather + HN while app is backgrounded |

### Load times (estimated)
| Scenario | Time to content |
|---|---|
| Cold load (first ever visit) | 1.5–3 seconds |
| Warm load (within 30 min cache TTL) | **~100–200ms** |
| Offline (cached) | **~50ms** |

---

## 🔄 Keeping it updated

If you update the HTML:
1. Edit `index.html` on GitHub (pencil icon)
2. Commit changes → GitHub Pages redeploys in ~30 seconds
3. All your devices get the update on next app launch

**That's it.** One URL, all your devices, no app store needed.
