# SPEC: LeetCode Journal (NeetCode 150)

A minimalist, black-and-white, monospace journal for logging my own solutions to the NeetCode 150. Public static site, vanilla HTML/CSS/JS, deployed on Vercel. Solutions live in the browser's localStorage.

Build exactly this. Don't add frameworks, build steps, npm runtime dependencies, or features not listed here. When something is ambiguous, pick the simpler option and note it in README.md.

---

## 1. Stack and files

- Plain HTML, CSS, JS (ES modules are fine). No React, no Tailwind, no bundler, no `package.json`.
- No external fonts, CDNs, or analytics. Zero network requests after page load.

```
/
├── index.html        # app shell
├── style.css
├── app.js            # all app logic
├── problems.js       # static NeetCode 150 list (exported const)
├── .gitignore
└── README.md         # how to run locally and deploy
```

---

## 3. Visual design

- **Colors:** white background (`#fff`), black text (`#000`). Grays allowed only for secondary text and borders (`#666`, `#ddd`). No dark mode. **One exception:** the activity heatmap cells and its legend use the red→purple scale in section 7. Color appears nowhere else in the UI.
- **Font:** monospace everywhere: `ui-monospace, "SF Mono", Menlo, Consolas, "Liberation Mono", monospace`. Base 15px, line-height 1.6.
- **Layout:** single centered column, `max-width: 820px`, generous whitespace. Borders are 1px solid black or `#ddd`. No shadows, no gradients, no border-radius above 2px, no icons libraries (use text glyphs).
- **Status glyphs:** `[ ]` todo, `[~]` attempted, `[x]` solved. Star: `★` / `☆`.
- **Difficulty:** plain text `E` / `M` / `H` (no color coding; it's black and white).
- Focus states must be visible (black outline). Fully keyboard-usable.
- Mobile: works at 375px wide, no horizontal scroll (code blocks scroll horizontally inside themselves).

---

## 4. Data

### 4.1 Problem list (static)

`problems.js` exports an ordered array of 150 objects:

```js
{ id: "group-anagrams", title: "Group Anagrams", category: "Arrays & Hashing", difficulty: "M", premium: false }
```

- `id` is the LeetCode slug; link is `https://leetcode.com/problems/${id}/`.
- `premium: true` for slugs marked `*` in Appendix A (strip the `*` from the id). Premium problems also show a second link: `https://neetcode.io/practice` (free versions exist there).
- Category order and problem order must match Appendix A exactly. Transcribe it; do not fetch anything or invent problems. Add a dev-time assertion (console error) if the array length isn't 150 or ids aren't unique.

### 4.2 Journal entries (localStorage)

Single key: `lcj:v1`. Value is JSON:

```js
{
  version: 1,
  lastExportAt: null | ISOString,
  roadmap: {
    startDate: null | "YYYY-MM-DD",   // day 1 of the 1-a-day plan
    dailyGoal: 1,                      // fixed at 1 for now, but read from here
    skips: { "YYYY-MM-DD": ["<problem id>"] }  // today's-problem skips, per day
  },
  entries: {
    "<problem id>": {
      status: "todo" | "attempted" | "solved",
      starred: boolean,
      lang: "python" | "java" | "other",
      approach: string,      // plain text, newlines preserved
      code: string,          // plain text
      time: string,          // e.g. "O(n·m)" free text
      space: string,
      notes: string,         // gotchas, mistakes, what to remember
      solvedAt: null | "YYYY-MM-DD",
      updatedAt: ISOString,
      reviews: ISOString[]   // timestamps of each "reviewed" click
    }
  }
}
```

Rules:
- Problems with no entry are implicitly `todo`, unstarred, empty.
- All reads/writes go through one small storage module (`load()`, `save()`, `getEntry(id)`, `updateEntry(id, patch)`).
- If stored JSON is corrupt: don't overwrite it. Copy the raw string to `lcj:corrupt:<timestamp>`, show a banner explaining it, start empty.
- Catch `QuotaExceededError` on save and show a visible error instead of failing silently.
- Include a `version` check so a future `v2` can migrate.
- **Dates are local, never UTC.** Any "YYYY-MM-DD" (solvedAt, today, heatmap days, skips) is built from the local date (`getFullYear/getMonth/getDate`), never `toISOString().slice(0,10)`, which flips to tomorrow after 7pm in Toronto and would break streaks. Put this in one `localDay(date)` helper and use it everywhere.

---

## 5. Views

Use hash routing so back/forward and direct links work:
- `#/` list view
- `#/p/<id>` problem view

### 5.1 Header (always visible on list view)

```
leetcode journal                                   37/150 solved
[ search...                    ]  all|todo|attempted|solved  E|M|H  ★
```

- Title (links to `#/`), total progress `solved/150` and a thin text progress bar (e.g. `[########............] 24%`).
- Search: filters by title and category, case-insensitive, live as you type.
- Status filter, difficulty filter, starred-only toggle. Filters combine (AND). Persist filter state in `sessionStorage`.
- A "random" button: opens a random problem that isn't solved (respecting current filters). If none, say so.

### 5.2 Roadmap block

Directly under the header, above the starred section, always visible on the list view (not collapsible; the point is to stare at it). Contents are defined in section 7:
1. Today line
2. Streak + pace line
3. Heatmap

### 5.3 Starred section

- At the very top of the list, before the categories, a section titled `★ starred (n)` listing all starred problems in NeetCode order.
- Hidden entirely when nothing is starred.
- Starred problems still also appear in their normal category.
- Collapsible; collapsed state persists.

### 5.4 List view (categories)

- One section per category in Appendix A order. Section header: `Arrays & Hashing  5/9` (solved/total).
- Each section is collapsible (click header). Collapsed state persists in localStorage under a separate key `lcj:ui`.
- Each row: `[x]  ★  Group Anagrams   M   2026-11-15`
  - status glyph, star toggle (clickable without opening the problem), title (link to `#/p/<id>`), difficulty, solvedAt (blank if none).
- Rows with a "due for review" flag (see 6) show a trailing `↻`.
- When filters hide every row in a category, hide that category.

### 5.5 Problem view (the "box")

Read mode by default when an entry exists; edit mode by default when it doesn't.

**Read mode** layout, top to bottom:
```
[~] ATTEMPTED                                         ★  edit
Group Anagrams
Arrays & Hashing · M · time O(...) · space O(...) · 2026-11-15 · LC↗

APPROACH
<approach text, whitespace preserved>

CODE                                                   python  copy
┌───────────────────────────────────────────────┐
│ <code, monospace, horizontal scroll, no wrap> │
└───────────────────────────────────────────────┘

NOTES
<notes>

reviewed 3× · last 2026-11-20                   [ mark reviewed ]
← prev    back to list    next →
```
- Empty sections (no notes, no code) are omitted, not shown blank.
- `copy` copies the code to clipboard and briefly shows `copied`.
- `prev`/`next` move through NeetCode order (wrap within the full list, not just the category).
- No syntax highlighting. Plain black code in a bordered box.

**Edit mode** fields:
- Status: three-way toggle `todo / attempted / solved`.
- Language: `python / java / other`.
- Time, Space: single-line text inputs.
- Approach: textarea, auto-grows.
- Code: textarea, monospace, auto-grows, no wrap. **Tab inserts 4 spaces** (Shift+Tab dedents the current line). Must not break normal focus navigation when Esc is pressed first.
- Notes: textarea.
- Solved date: date input. Auto-fills with today the first time status becomes `solved`; editable after.
- Buttons: `save`, `cancel`, and `clear entry` (confirm in-page, not with `window.confirm`).

Draft safety:
- Autosave edits to the entry, debounced ~800ms, and show a quiet `saved` / `saving…` indicator. Cancel reverts to the state when edit mode was entered.
- If the user navigates away with unsaved changes mid-debounce, flush the save first.

---

## 6. Review (lightweight spaced repetition)

- `mark reviewed` appends a timestamp to `reviews`.
- A solved problem is **due for review** when its most recent of (`solvedAt`, last review) is older than 14 days.
- Header gets a `due (n)` filter toggle showing only due problems.
- That's it. No scheduling algorithm, no notifications.

---

## 7. Roadmap: one problem a day

Goal: make it obvious every day whether I've done today's problem, and make breaking the streak visible.

### 7.1 What counts as "a day done"

- A day counts when at least one problem has `solvedAt` equal to that date. That's the only source of activity. Everything here is **derived from `solvedAt`**; no separate activity log.
- Reviews (section 6) do **not** count toward the streak or the heatmap while unsolved problems remain. Otherwise clicking `mark reviewed` keeps the streak alive without solving anything. Once all 150 are solved, reviews start counting (each review timestamp's local day counts as activity).
- Editing an old entry's code/notes does not count. Only `solvedAt` matters.
- Backfilling is allowed: setting `solvedAt` to a past date shows up on that past day. (It's my journal; if I lie to it, that's on me.)

### 7.2 Today line

```
today  #38 Koko Eating Bananas  M  Binary Search        [ open ]  skip
```
- Today's problem = the first unsolved problem in Appendix A order, excluding ids in `roadmap.skips[today]`. `#38` is its position in the 150.
- `open` goes to `#/p/<id>` in edit mode. `skip` adds it to today's skips and shows the next one (skipping is for "this one's premium / I'm not at a computer with LC Premium", not a reorder; it resets tomorrow).
- Once today has ≥1 solve, the line becomes: `today  done ✓  Koko Eating Bananas` (lists what was solved today, comma-separated). Optional link `do another →` shows the next unsolved.
- When all 150 are solved: `today  all 150 done. review something due →` linking to the due filter.

### 7.3 Streak + pace line

```
streak 12 days · best 19 · 37/150 · finish ~2027-04-15 · 2 ahead
```
- **Current streak:** consecutive done days ending today. If today isn't done yet, count back from yesterday and show the streak in gray with `· do today's to keep it`. If neither today nor yesterday is done, streak is 0.
- **Best streak:** longest run of consecutive done days ever.
- **Projected finish** at `dailyGoal` per day, shown as YYYY-MM-DD: if today isn't done yet, today counts as day 1, so `today + (unsolved − 1)` days; if today is done, `today + unsolved` days. (Example: 150 unsolved on 2026-11-17 → 2027-04-15.)
- **Ahead/behind:** `solved − days elapsed since startDate (inclusive)`. Positive = `n ahead`, negative = `n behind`, zero = `on pace`. Hidden if `startDate` is null.
- `startDate` auto-sets to the earliest `solvedAt` the first time anything is solved, and is editable via a small `set start` link (date input). Changing it only affects ahead/behind.

### 7.4 Heatmap

GitHub contribution graph, minimalist.

- 53 columns (weeks) × 7 rows (Sun→Sat), ending with the current week on the right. Cells ~11px with 3px gaps, square corners (radius ≤ 2px). Days after today in the current week are not drawn.
- Small gray month labels above the columns where a month starts; `Mon / Wed / Fri` labels on the left in gray.
- On narrow screens the grid scrolls horizontally inside its own container and starts scrolled all the way right (today visible).
- Today's cell gets a 1px black outline so I can find it.
- Color = number of problems solved that day:

| solved that day | color | hex |
|---|---|---|
| 0 | empty | `#eeeeee` |
| 1 | light red | `#fca5a5` |
| 2 | red | `#ef4444` |
| 3 | red hot | `#b91c1c` |
| 4+ | purple | `#7e22ce` |

- Put these five values in CSS custom properties (`--heat-0` … `--heat-4`) so they're tweakable in one place.
- Legend under the grid, right-aligned: `less ▢▢▢▢▢ more` using the five colors.
- Hover / keyboard focus on a cell shows its date and what was solved, e.g. `2026-11-15 · 2 solved: Group Anagrams, Two Sum`. Use a small custom tooltip (B&W) or `title`; cells need `aria-label` with the same text.
- Clicking a non-empty cell filters the list to problems solved that day (shown as a removable filter chip `solved on 2026-11-15 ×`).
- Under the grid, gray: `n problems in the last year · n active days`.

### 7.5 Recompute

All roadmap numbers are pure functions of the stored data plus today's local date. Recompute on every save, on import, and when the tab regains focus after midnight (check on `visibilitychange`), so leaving the tab open overnight doesn't show yesterday as today.

---

## 8. Backup (mandatory, because localStorage is fragile)

localStorage dies when the browser data is cleared, and it doesn't sync between devices. So:

- **Export:** footer button downloads `leetcode-journal-YYYY-MM-DD.json` (the full `lcj:v1` object). Sets `lastExportAt`.
- **Import:** footer button accepts a `.json` file. Validate shape and version. Show a summary (`42 entries, 3 conflict with existing`) and offer `replace all` or `merge (newer updatedAt wins)`. Never import silently.
- **Reminder banner:** if there are entries and `lastExportAt` is null or older than 7 days, show a one-line dismissible banner at the top: `last backup: 9 days ago. export`. Dismissal lasts 24h.

---

## 9. Keyboard shortcuts

Only when focus isn't in an input/textarea, except where noted:
- `/` focus search
- `Esc` clear search / leave edit mode (prompts if dirty) / back to list
- `e` edit current problem
- `s` toggle star on current problem
- `j` / `k` next / previous problem in problem view
- `r` random unsolved
- `t` open today's problem
- `Ctrl/Cmd+S` save (works inside inputs; prevent browser save dialog)
- `?` show a small shortcuts overlay

---

## 10. Non-goals

Do not build: accounts, a database, cloud sync, syntax highlighting, themes/dark mode, charts (the section 7 heatmap is the only graphic), streak freezes, notifications, tags beyond category, multiple solutions per problem, a markdown renderer, a service worker, or any third-party script.

---

## 11. Acceptance checklist

Claude Code: verify each of these yourself before calling it done (serve the folder locally and test in a browser).

- [ ] Exactly 150 problems render, in 18 categories, in Appendix A order. Category totals match the counts in Appendix A.
- [ ] Starring a problem makes it appear in the starred section; unstarring removes it; section hides at 0.
- [ ] Creating an entry, reloading the page, and reopening it shows identical content (whitespace in code preserved exactly).
- [ ] Tab in the code box inserts 4 spaces; Shift+Tab dedents.
- [ ] Setting status to solved auto-fills today's date once; changing status back and forth doesn't overwrite a manually edited date.
- [ ] Filters combine correctly; search + `solved` + `M` + starred narrows as expected.
- [ ] Direct link `#/p/lru-cache` opens that problem. Back button returns to the list with scroll position roughly kept.
- [ ] Export → clear localStorage → import (replace) restores everything byte-for-byte.
- [ ] Import merge keeps the newer entry on conflict.
- [ ] Corrupt `lcj:v1` (set it to `"{bad"` manually) produces the banner and a `lcj:corrupt:*` backup, not a crash.
- [ ] No horizontal page scroll at 375px width.
- [ ] Only black, white, and the allowed grays appear in the UI, except the five heatmap colors.
- [ ] Heatmap: solving 0/1/2/3/4+ problems on a day (backfill solvedAt to test) produces the matching five colors on the right cells.
- [ ] Solving a problem at 11pm local time lands on today's cell, not tomorrow's (test by mocking the clock).
- [ ] Streak: done yesterday + not today shows the gray "keep it" state; skipping a day resets current streak to 0 but keeps best.
- [ ] Marking reviews does not change the streak or heatmap while unsolved problems remain.
- [ ] Today line shows the first unsolved problem in Appendix A order; `skip` moves to the next and resets the next day.
- [ ] Projected finish with 150 unsolved and today not done on 2026-11-17 is 2027-04-15.
- [ ] Leaving the tab open past midnight and refocusing it updates the today line and heatmap.
- [ ] No console errors. No network requests other than the page's own files.

---

## 12. Deploy (put this in README.md)

1. Push the repo to GitHub, import it in Vercel (framework preset: Other, no build command, output directory: root).
2. Every push to `main` redeploys.
3. Local: serve the folder with any static file server (e.g. `python3 -m http.server 3000`).

---

## 13. Handoff: walk me through deploying

When everything in section 11 passes, finish by giving me a short, numbered walkthrough of **only the steps I have to do myself** to get this live on Vercel. Don't make me read section 12 and work it out.

- Before writing it, check what you can do yourself (git init and commit, `vercel` CLI if it's installed and logged in) and do it. Then list only what's left for me, e.g. creating the GitHub repo, logging into Vercel, importing the project.
- For each step say exactly where to click or what to run, and what I should see when it worked.
- End with how to check it worked: open the URL and confirm the app loads with the list at 0/150 solved.
- If nothing is required from me, just say so and give the URL.

---

## Appendix A: NeetCode 150

Format: `difficulty | title | leetcode-slug`. A trailing `*` on the slug means LeetCode Premium (set `premium: true`, strip the `*`). 18 categories, 150 problems.

### Arrays & Hashing (9)

- E | Contains Duplicate | contains-duplicate
- E | Valid Anagram | valid-anagram
- E | Two Sum | two-sum
- M | Group Anagrams | group-anagrams
- M | Top K Frequent Elements | top-k-frequent-elements
- M | Encode and Decode Strings | encode-and-decode-strings*
- M | Product of Array Except Self | product-of-array-except-self
- M | Valid Sudoku | valid-sudoku
- M | Longest Consecutive Sequence | longest-consecutive-sequence

### Two Pointers (5)

- E | Valid Palindrome | valid-palindrome
- M | Two Sum II - Input Array Is Sorted | two-sum-ii-input-array-is-sorted
- M | 3Sum | 3sum
- M | Container With Most Water | container-with-most-water
- H | Trapping Rain Water | trapping-rain-water

### Sliding Window (6)

- E | Best Time to Buy and Sell Stock | best-time-to-buy-and-sell-stock
- M | Longest Substring Without Repeating Characters | longest-substring-without-repeating-characters
- M | Longest Repeating Character Replacement | longest-repeating-character-replacement
- M | Permutation in String | permutation-in-string
- H | Minimum Window Substring | minimum-window-substring
- H | Sliding Window Maximum | sliding-window-maximum

### Stack (7)

- E | Valid Parentheses | valid-parentheses
- M | Min Stack | min-stack
- M | Evaluate Reverse Polish Notation | evaluate-reverse-polish-notation
- M | Generate Parentheses | generate-parentheses
- M | Daily Temperatures | daily-temperatures
- M | Car Fleet | car-fleet
- H | Largest Rectangle in Histogram | largest-rectangle-in-histogram

### Binary Search (7)

- E | Binary Search | binary-search
- M | Search a 2D Matrix | search-a-2d-matrix
- M | Koko Eating Bananas | koko-eating-bananas
- M | Find Minimum in Rotated Sorted Array | find-minimum-in-rotated-sorted-array
- M | Search in Rotated Sorted Array | search-in-rotated-sorted-array
- M | Time Based Key-Value Store | time-based-key-value-store
- H | Median of Two Sorted Arrays | median-of-two-sorted-arrays

### Linked List (11)

- E | Reverse Linked List | reverse-linked-list
- E | Merge Two Sorted Lists | merge-two-sorted-lists
- E | Linked List Cycle | linked-list-cycle
- M | Reorder List | reorder-list
- M | Remove Nth Node From End of List | remove-nth-node-from-end-of-list
- M | Copy List with Random Pointer | copy-list-with-random-pointer
- M | Add Two Numbers | add-two-numbers
- M | Find the Duplicate Number | find-the-duplicate-number
- M | LRU Cache | lru-cache
- H | Merge k Sorted Lists | merge-k-sorted-lists
- H | Reverse Nodes in k-Group | reverse-nodes-in-k-group

### Trees (15)

- E | Invert Binary Tree | invert-binary-tree
- E | Maximum Depth of Binary Tree | maximum-depth-of-binary-tree
- E | Diameter of Binary Tree | diameter-of-binary-tree
- E | Balanced Binary Tree | balanced-binary-tree
- E | Same Tree | same-tree
- E | Subtree of Another Tree | subtree-of-another-tree
- M | Lowest Common Ancestor of a Binary Search Tree | lowest-common-ancestor-of-a-binary-search-tree
- M | Binary Tree Level Order Traversal | binary-tree-level-order-traversal
- M | Binary Tree Right Side View | binary-tree-right-side-view
- M | Count Good Nodes in Binary Tree | count-good-nodes-in-binary-tree
- M | Validate Binary Search Tree | validate-binary-search-tree
- M | Kth Smallest Element in a BST | kth-smallest-element-in-a-bst
- M | Construct Binary Tree from Preorder and Inorder Traversal | construct-binary-tree-from-preorder-and-inorder-traversal
- H | Binary Tree Maximum Path Sum | binary-tree-maximum-path-sum
- H | Serialize and Deserialize Binary Tree | serialize-and-deserialize-binary-tree

### Heap / Priority Queue (7)

- E | Kth Largest Element in a Stream | kth-largest-element-in-a-stream
- E | Last Stone Weight | last-stone-weight
- M | K Closest Points to Origin | k-closest-points-to-origin
- M | Kth Largest Element in an Array | kth-largest-element-in-an-array
- M | Task Scheduler | task-scheduler
- M | Design Twitter | design-twitter
- H | Find Median from Data Stream | find-median-from-data-stream

### Backtracking (9)

- M | Subsets | subsets
- M | Combination Sum | combination-sum
- M | Combination Sum II | combination-sum-ii
- M | Permutations | permutations
- M | Subsets II | subsets-ii
- M | Word Search | word-search
- M | Palindrome Partitioning | palindrome-partitioning
- M | Letter Combinations of a Phone Number | letter-combinations-of-a-phone-number
- H | N-Queens | n-queens

### Tries (3)

- M | Implement Trie (Prefix Tree) | implement-trie-prefix-tree
- M | Design Add and Search Words Data Structure | design-add-and-search-words-data-structure
- H | Word Search II | word-search-ii

### Graphs (13)

- M | Number of Islands | number-of-islands
- M | Max Area of Island | max-area-of-island
- M | Clone Graph | clone-graph
- M | Walls and Gates | walls-and-gates*
- M | Rotting Oranges | rotting-oranges
- M | Pacific Atlantic Water Flow | pacific-atlantic-water-flow
- M | Surrounded Regions | surrounded-regions
- M | Course Schedule | course-schedule
- M | Course Schedule II | course-schedule-ii
- M | Graph Valid Tree | graph-valid-tree*
- M | Number of Connected Components in an Undirected Graph | number-of-connected-components-in-an-undirected-graph*
- M | Redundant Connection | redundant-connection
- H | Word Ladder | word-ladder

### Advanced Graphs (6)

- M | Network Delay Time | network-delay-time
- H | Reconstruct Itinerary | reconstruct-itinerary
- M | Min Cost to Connect All Points | min-cost-to-connect-all-points
- H | Swim in Rising Water | swim-in-rising-water
- H | Alien Dictionary | alien-dictionary*
- M | Cheapest Flights Within K Stops | cheapest-flights-within-k-stops

### 1-D Dynamic Programming (12)

- E | Climbing Stairs | climbing-stairs
- E | Min Cost Climbing Stairs | min-cost-climbing-stairs
- M | House Robber | house-robber
- M | House Robber II | house-robber-ii
- M | Longest Palindromic Substring | longest-palindromic-substring
- M | Palindromic Substrings | palindromic-substrings
- M | Decode Ways | decode-ways
- M | Coin Change | coin-change
- M | Maximum Product Subarray | maximum-product-subarray
- M | Word Break | word-break
- M | Longest Increasing Subsequence | longest-increasing-subsequence
- M | Partition Equal Subset Sum | partition-equal-subset-sum

### 2-D Dynamic Programming (11)

- M | Unique Paths | unique-paths
- M | Longest Common Subsequence | longest-common-subsequence
- M | Best Time to Buy and Sell Stock with Cooldown | best-time-to-buy-and-sell-stock-with-cooldown
- M | Coin Change II | coin-change-ii
- M | Target Sum | target-sum
- M | Interleaving String | interleaving-string
- H | Longest Increasing Path in a Matrix | longest-increasing-path-in-a-matrix
- H | Distinct Subsequences | distinct-subsequences
- M | Edit Distance | edit-distance
- H | Burst Balloons | burst-balloons
- H | Regular Expression Matching | regular-expression-matching

### Greedy (8)

- M | Maximum Subarray | maximum-subarray
- M | Jump Game | jump-game
- M | Jump Game II | jump-game-ii
- M | Gas Station | gas-station
- M | Hand of Straights | hand-of-straights
- M | Merge Triplets to Form Target Triplet | merge-triplets-to-form-target-triplet
- M | Partition Labels | partition-labels
- M | Valid Parenthesis String | valid-parenthesis-string

### Intervals (6)

- M | Insert Interval | insert-interval
- M | Merge Intervals | merge-intervals
- M | Non-overlapping Intervals | non-overlapping-intervals
- E | Meeting Rooms | meeting-rooms*
- M | Meeting Rooms II | meeting-rooms-ii*
- H | Minimum Interval to Include Each Query | minimum-interval-to-include-each-query

### Math & Geometry (8)

- M | Rotate Image | rotate-image
- M | Spiral Matrix | spiral-matrix
- M | Set Matrix Zeroes | set-matrix-zeroes
- E | Happy Number | happy-number
- E | Plus One | plus-one
- M | Pow(x, n) | powx-n
- M | Multiply Strings | multiply-strings
- M | Detect Squares | detect-squares

### Bit Manipulation (7)

- E | Single Number | single-number
- E | Number of 1 Bits | number-of-1-bits
- E | Counting Bits | counting-bits
- E | Reverse Bits | reverse-bits
- E | Missing Number | missing-number
- M | Sum of Two Integers | sum-of-two-integers
- M | Reverse Integer | reverse-integer
