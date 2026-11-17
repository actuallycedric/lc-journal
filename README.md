# leetcode journal

A black-and-white, monospace journal for logging my own NeetCode 150 solutions. A plain public static site: HTML/CSS/JS, no build step, no dependencies. Solutions live in the browser's localStorage, so nothing I write ever leaves the browser.

## files

- `index.html` - app shell
- `style.css` - styles; heatmap colours are `--heat-0` … `--heat-4` at the top
- `app.js` - all app logic (storage, views, roadmap, heatmap, backup, shortcuts)
- `problems.js` - the NeetCode 150, in order
- `SPEC.md` - what the app is supposed to do

## run locally

Any static file server works, from the project root:

```bash
python3 -m http.server 3000
```

Then open http://localhost:3000. (Opening `index.html` straight from disk won't work: browsers block ES modules on `file://`.)

## deploy

1. Push the repo to GitHub, import it in Vercel (framework preset: **Other**, no build command, output directory: root).
2. Every push to `main` redeploys.

## data

Everything is in localStorage under `lcj:v1` (UI prefs under `lcj:ui`, filters in sessionStorage). It's per browser and per domain: it doesn't sync between devices, it's separate on localhost and on the deployed URL, and it disappears if site data is cleared. Use **export** in the footer regularly; a banner nags after 7 days. **import** shows a summary and lets you replace everything or merge (newer `updatedAt` wins).

If `lcj:v1` can't be parsed, the raw text is copied to `lcj:corrupt:<timestamp>`, a banner says so, and the journal starts empty.

## shortcuts

`/` search · `esc` clear search / leave edit mode / back to list · `e` edit · `s` star · `j` / `k` next / previous · `r` random unsolved · `t` today's problem · `ctrl/cmd+s` save · `?` list of shortcuts. In the code box, Tab inserts 4 spaces and Shift+Tab dedents; press Esc first to Tab out of it.

## decisions where the spec was open

- **"Entry exists"** (read mode vs edit mode by default) means the entry has content: a status other than todo, a solved date, or any text. Starring alone doesn't count.
- **Activity is solved problems with a `solvedAt`.** If a problem goes back to attempted, its date is kept (so toggling never loses a hand-edited date) but it stops counting on the heatmap and streak, and the list hides the date.
- **Due for review** needs a solved date or a review; a solved problem with neither is never due. `mark reviewed` only shows on solved problems.
- **Difficulty filter** is three toggles (none selected = all). The starred section obeys the filters too, and hides when nothing in it matches.
- **Collapsed categories stay collapsed while filtering**; the header shows `· n shown` so matches aren't hidden silently.
- **Saving.** `save` saves and returns to read mode; Ctrl/Cmd+S saves and stays in edit mode. Leaving edit mode by navigating keeps changes. Esc asks keep / discard / keep editing if anything changed since edit mode started. `cancel` restores the entry exactly as it was when editing started.
- **`clear entry`** deletes the entry, so the problem is back to an implicit todo.
- **Import merge** takes the newer `updatedAt` per entry and the earlier of the two start dates; local skips and `lastExportAt` are kept. Ids that aren't in the 150 are skipped and counted in the summary. A file with an unknown `version` is rejected.
- **Unknown stored version** is treated like corrupt data (backed up, start empty). `migrate()` in `app.js` is where a future v2 upgrade goes.
- **Skips** are stored by day and older days are dropped on the next save.
- **Projected finish** uses `ceil(unsolved / dailyGoal)` days.
- **Heatmap** is one tab stop: arrow keys move between days, Enter on a coloured day filters the list. Month labels are skipped in the last two columns where they'd be clipped.
