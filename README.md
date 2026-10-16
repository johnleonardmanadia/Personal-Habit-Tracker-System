# Focus Tracker — Personal Productivity & Habit Tracker

A local-first app for tracking focus sessions, activities, goals and streaks. Plain HTML, CSS and JavaScript (ES modules). No frameworks, no build step, no paid services, no account, no tracking.

## Features
Dashboard · Activities · Focus timer (survives refresh, with recovery) · Session history · GitHub-style contribution calendar · Statistics · Planner & goals · Settings · JSON/CSV export and JSON import · Optional offline/installable PWA.

## Folder structure
```
index.html, manifest.json, service-worker.js, package.json (tests only)
css/    reset, variables, layout, components, dashboard, activities, timer,
        contributions, statistics, settings, responsive
js/     app.js, router.js, database.js, state.js, utils.js
  components/  navigation, modal, notifications, confirmation
  modules/     dashboard, activities, timer, sessions, contributions, statistics,
               goals (planner + goals), settings, export-import, notifications
  tests/       timer, contributions, statistics, export-import
assets/icons/  PNG icons      icons/app-icon.svg
assets/vendor/fontawesome/  self-hosted Font Awesome Free (CSS, font, license)
```

## Requirements
- Windows laptop, Visual Studio Code, and a modern browser (Chrome, Edge, Firefox or Safari).
- The **Live Server** extension for VS Code (free).
- Node.js 18+ is needed **only** to run the tests (https://nodejs.org).

## Run it (Windows + VS Code)
1. Extract the zip. Open VS Code > **File > Open Folder** > choose the folder that directly contains `index.html`.
2. Press `Ctrl+Shift+X`, search **Live Server** (by Ritwick Dey), click **Install**.
3. Right-click `index.html` > **Open with Live Server**. The browser opens `http://127.0.0.1:5500/`.

> Do **not** double-click `index.html`. Browsers block JavaScript modules on `file://` addresses, so the page would stay empty.

### No Live Server? Use a terminal instead
In VS Code press `` Ctrl+` `` and run one of:
```
py -m http.server 5500
npx serve .
```
Then open `http://localhost:5500`.

## Install as an app (PWA)
Open the app from a local server in Chrome or Edge and use the install icon in the address bar (or **⋮ > Cast, save and share > Install page as app**). Install support depends on the browser; it is not guaranteed everywhere.

## Where is my data?
In your browser's **IndexedDB** for this site's address (for example `127.0.0.1:5500`), plus small preferences in LocalStorage. Important consequences:
- A different address or port (`localhost:5500` vs `127.0.0.1:5500`, or `:5501`) is a **different, empty** database. Always use the same address.
- Another browser, profile or device has its own separate data. **Nothing syncs automatically.**
- Clearing site data, browser cleanup tools or a reinstall can erase it. In Settings you can ask the browser to keep the data (persistent storage), but back up regularly.

## Back up and restore
**Settings > Your data**
- **Export backup (JSON)**: activities, sessions, planned items, goals, preferences and schema version.
- **Export sessions (CSV)**: opens in Excel or Google Sheets.
- **Import backup…**: the file is validated first, you see a preview, then choose **Merge** (adds only new records) or **Replace** (a safety backup downloads first). Malformed files are rejected without changing anything.
- **Erase all data…**: you must type `RESET`; a backup button is offered first.

## The focus timer
- Remaining time is computed from a saved deadline (`Date.now()`), not by counting seconds, so tab switching and throttling do not drift it. Paused time never counts.
- Active timer state is saved, so a refresh keeps it running.
- If the app wasn't running for over a minute (laptop sleep, closed browser), nothing is saved automatically. A "Welcome back" card lets you count the time away, skip it (pause where the app last saw it), or discard.
- **Browser limits:** a web page cannot guarantee an alarm or background execution on every device. Sound plays only if the tab is allowed to run, and system notifications need your permission and may be delayed or dropped by the OS. Keep the tab open during important sessions.

## Rules used for counts and streaks
- A saved session with status *completed* or *finished early* counts as one contribution. Cancelled sessions are never saved.
- Heatmap intensity follows daily focus minutes (or session count in that view). All dates use your **local** calendar.
- A streak is consecutive local days with at least one valid session. If you haven't recorded anything yet *today*, the current streak stays alive until the day ends.
- Completion rate = sessions that ran their full planned time ÷ all saved sessions.
- Ticking a planner task does not create a session, so it never changes focus time, goals or contributions.

## Put it online with GitHub Pages
All paths are relative, so it works from a repo root (`https://<user>.github.io/<repo>/`) or from a subfolder of an existing repo.

1. Install Git for Windows (https://git-scm.com) and create an empty repository on GitHub.
2. In VS Code open the terminal (`` Ctrl+` ``) inside this folder and run:
```
git init
git add .
git commit -m "Add Focus Tracker"
git branch -M main
git remote add origin https://github.com/<your-username>/<your-repo>.git
git push -u origin main
```
3. On GitHub: **Settings > Pages > Build and deployment > Deploy from a branch > `main` / `(root)` > Save**. After a minute the site is live. (Pages must be served over HTTPS, which GitHub does for you.)
4. Adding it to an **existing** repo instead? Copy this folder into it, push, and open `https://<user>.github.io/<repo>/personal-productivity-tracker/`.
5. After you change files, push again and bump `CACHE_VERSION` in `service-worker.js` so visitors' cached copies refresh.

**Things to know before publishing**
- Every visitor gets their **own** empty data in **their own** browser. You never see their data and they never see yours.
- All `*.github.io` pages of one account share one browser *origin*, and IndexedDB is per origin. Other sites under the same account could read this app's data in *your* browser. Put it in a repo with only your own trusted pages, or use a custom domain.
- A Content-Security-Policy is set in `index.html` (scripts, fonts, images and requests only from the same site, no external services). GitHub Pages cannot send custom HTTP headers, so headers such as `frame-ancestors` cannot be set.
- Data is not encrypted. Anyone using your device and browser profile can open it.

## Icons and licenses
Icons come from **Font Awesome Free** (v7), self-hosted in `assets/vendor/fontawesome/` so the app works offline and under the CSP. Icons: CC BY 4.0, fonts: SIL OFL 1.1, code: MIT. Keep the `LICENSE.txt` in that folder when you publish.

## Tests
In a terminal opened in the project folder:
```
node --test
```
(or `npm test`). 26 tests cover timer math, recovery, contribution counting, leap years, year/month boundaries, streaks, statistics and backup validation.

## What works offline
After the first successful load over a local server, the app shell is cached and the app opens offline; your data is local anyway. The service worker is network-first, so your edits appear on reload while online. Nothing about your data is cached by it. Not supported: syncing between devices, background timers while the browser is closed.

## Troubleshooting
- **Blank dark page** > you opened `file://`. Use Live Server (see above); the app shows a hint when it detects this.
- **"Failed to load module" / 404 in the Console (`F12`)** > open the folder that directly contains `index.html`, and keep the folder structure unchanged.
- **Old version still showing** > hard reload with `Ctrl+Shift+R`. If needed: `F12` > **Application** > **Service Workers** > *Unregister*, then **Storage > Clear site data** (this also erases app data, so export a backup first). When you edit files for your own changes, bump `CACHE_VERSION` in `service-worker.js`.
- **"Database unavailable"** > private/incognito windows or strict privacy settings can block IndexedDB. Use a normal window and allow site storage. If a second tab blocks an upgrade, close other tabs and reload.
- **Data seems missing** > check the address/port is the same as before, then try importing your latest backup.
- **Notifications don't appear** > allow them in the browser's site settings, then re-enable the toggle in Settings.
