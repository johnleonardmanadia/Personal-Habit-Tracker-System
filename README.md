

# Focus Tracker

A local-first personal productivity and habit tracker. Plan your day, run focus timers, and watch your consistency grow on a GitHub-style contribution calendar.

Built with plain HTML, CSS and JavaScript (ES modules). No frameworks, no build step, no accounts, no paid services, and no tracking. All data stays in your browser.

## Contents

- [Features](#features)
- [Quick start](#quick-start)
- [Project structure](#project-structure)
- [How the app counts things](#how-the-app-counts-things)
- [Your data](#your-data)
- [Install and offline use](#install-and-offline-use)
- [Publish on GitHub Pages](#publish-on-github-pages)
- [Tests](#tests)
- [Troubleshooting](#troubleshooting)
- [Credits and licenses](#credits-and-licenses)

## Features

| Page | What it does |
| --- | --- |
| Dashboard | Today's focus time, sessions, streaks, daily goal, weekly chart, contribution graph |
| Activities | Create, edit, archive and delete activities with icons, colors and daily targets |
| Timer | Countdown timer that survives refreshes, with pause, resume, breaks and session recovery |
| History | Search, filter and review every saved session; log sessions manually |
| Contributions | Yearly heatmap by focus minutes or session count, with per-day details |
| Statistics | Totals, trends, top activities, categories and per-activity streaks |
| Planner | Daily plan with timed items and tasks, plus total, category and activity goals |
| Settings | Theme, timer defaults, notifications, backup, restore and reset |

The layout adapts to desktop (sidebar), tablet (compact icon rail) and phone (hamburger menu).

## Quick start

**Requirements:** a modern browser, Visual Studio Code, and the free **Live Server** extension.

1. Extract the zip.
2. In VS Code choose **File > Open Folder** and pick the folder that directly contains `index.html`.
3. Install **Live Server** (`Ctrl+Shift+X`, search "Live Server" by Ritwick Dey).
4. Right-click `index.html` and choose **Open with Live Server**.

The app opens at `http://127.0.0.1:5500/`.

> Do not double-click `index.html`. Browsers block JavaScript modules on `file://` addresses, so the page would stay empty. The app shows a hint if it detects this.

**No Live Server?** Open a terminal in the project folder and run one of:

```
py -m http.server 5500
npx serve .
```

Then open `http://localhost:5500`.

## Project structure

```
index.html            App shell
manifest.json         PWA manifest
service-worker.js     Offline cache (app shell only)
package.json          Used only to run the tests

css/                  Stylesheets (variables, layout, components, one per page)
js/
  app.js              Startup
  router.js           Hash router
  database.js         IndexedDB wrapper and schema
  state.js            Shared state and preferences
  utils.js            Dates, formatting, streaks, icons
  components/         navigation, modal, notifications, confirmation
  modules/            dashboard, activities, timer, sessions, contributions,
                      statistics, goals, settings, export-import, notifications
  tests/              Automated tests
assets/icons/         App icons (PNG)
assets/vendor/        Self-hosted Font Awesome Free
icons/app-icon.svg    App icon (SVG)
```

## How the app counts things

- A saved session with status **completed** or **finished early** counts as one contribution. Cancelled sessions are never saved.
- Heatmap intensity follows daily focus minutes (or session count in that view).
- All dates use your **local** calendar, so there are no UTC off-by-one-day errors.
- A **streak** is a run of consecutive days with at least one valid session. If you have not recorded anything yet today, the current streak stays alive until the day ends.
- **Completion rate** is sessions that ran their full planned time divided by all saved sessions.
- Ticking a planner task does not create a session, so it never changes focus time, goals or contributions.

### The timer

- Remaining time is calculated from a saved deadline, not by counting seconds, so tab switching and browser throttling do not cause drift. Paused time never counts.
- The active timer is saved, so refreshing the page keeps it running.
- If the app was not running for more than a minute (sleep, closed browser), nothing is saved automatically. A "Welcome back" card lets you count the time away, skip it, or discard the session.
- Browsers cannot guarantee an alarm or background execution. Sound and system notifications only work when the browser allows them, so keep the tab open for important sessions.

## Your data

Data is stored in your browser's **IndexedDB** for the site address you use, plus small preferences in LocalStorage.

- Each address and port is a separate database. `localhost:5500` and `127.0.0.1:5500` do not share data, so always use the same one.
- Another browser, profile or device has its own separate data. Nothing syncs automatically.
- Clearing site data or browser cleanup tools can erase it. Back up regularly.
- Data is not encrypted.

### Backup and restore

Go to **Settings > Your data**.

| Action | Result |
| --- | --- |
| Export backup (JSON) | Activities, sessions, plans, goals, preferences and schema version |
| Export sessions (CSV) | Session history for Excel or Google Sheets |
| Import backup | Validates the file, shows a preview, then lets you **Merge** (adds new records only) or **Replace** (downloads a safety backup first). Invalid files are rejected without any change |
| Erase all data | Requires typing `RESET`; offers a backup first |

Do not commit or share backup files; they contain your personal data.

## Install and offline use

In Chrome or Edge, open the app from a local server or from GitHub Pages and use the install icon in the address bar. Install support depends on the browser.

After one successful load, the app shell is cached and opens offline. The service worker is network-first, so updates appear on reload while you are online. It never caches your data. Syncing between devices and background timers while the browser is closed are not supported.

## Publish on GitHub Pages

All paths are relative, so the app works from a repository root or from a subfolder.

1. Install [Git for Windows](https://git-scm.com) and create an empty repository on GitHub.
2. In the VS Code terminal (`` Ctrl+` ``) inside this folder, run:

```
git init
git add .
git commit -m "Add Focus Tracker"
git branch -M main
git remote add origin https://github.com/<your-username>/<your-repo>.git
git push -u origin main
```

3. On GitHub open **Settings > Pages**, choose **Deploy from a branch**, select `main` and `/ (root)`, then save.
4. The site is live at `https://<your-username>.github.io/<your-repo>/` after a minute. If you copied this folder into an existing repository, add `/personal-productivity-tracker/` to the address.
5. After changing files, push again and increase `CACHE_VERSION` in `service-worker.js` so visitors' cached copies refresh.

**Before you publish**

- Every visitor has their own data in their own browser. You never see theirs and they never see yours.
- All `*.github.io` pages of one account share a browser origin. Keep other untrusted scripts off the same account, or use a custom domain.
- Turn on two-factor authentication for your GitHub account. Anyone who gains write access could change the site's code.
- A Content-Security-Policy is set in `index.html`. GitHub Pages cannot send custom HTTP headers, so some headers (such as `frame-ancestors`) cannot be set.
- The `.gitignore` excludes backup and export files. Keep it.

## Tests

Install [Node.js](https://nodejs.org) 18 or newer (only needed for tests), then run in the project folder:

```
node --test
```

The 26 tests cover timer math and recovery, contribution counting, leap years, year and month boundaries, streaks, statistics and backup validation.

## Troubleshooting

| Problem | Fix |
| --- | --- |
| Blank dark page | You opened the file by double-clicking. Use Live Server |
| "Failed to load module" or 404 in the Console (`F12`) | Open the folder that directly contains `index.html` and keep the folder structure unchanged |
| Old version still showing | Hard reload with `Ctrl+Shift+R`. If needed, `F12` > **Application** > **Service Workers** > Unregister |
| "Database unavailable" | Private windows or strict privacy settings can block IndexedDB. Use a normal window and allow site storage. Close other tabs of the app and reload |
| Data seems missing | Check you are using the same address and port as before, then import your latest backup |
| No notifications | Allow them in the browser's site settings, then switch the option off and on in Settings |

Clearing site data also erases your app data, so export a backup first.

## Credits and licenses

Icons are from [Font Awesome Free](https://fontawesome.com) (icons CC BY 4.0, fonts SIL OFL 1.1, code MIT), self-hosted in `assets/vendor/fontawesome/` so the app works offline. Keep the `LICENSE.txt` in that folder when you publish.