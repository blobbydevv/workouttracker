# Built With Science+ recreation — parity record

**Status: NOT a 1:1 replica.** Visual parity is unverified for every screen, because no
same-version screenshots or recordings were available. Behavioural parity covers only
documented behaviour. All gaps are listed below.

## 1. Reference log

| # | Reference | Version / date | How obtained | Used for |
|---|-----------|----------------|--------------|----------|
| R1 | App Store listing `apps.apple.com/gb/app/built-with-science/id6446000532` | unknown | **Blocked**: the build environment's network policy rejected `apps.apple.com` and `is1-ssl.mzstatic.com`. | nothing |
| R2 | Help centre `help.builtwithscience.com` and `builtwithscience-support.zendesk.com` | articles undated | **Blocked** for direct fetch. Only web-search result summaries were available (paraphrased, not verbatim). | Documented behaviour (D-rows below) |
| R3 | User's task brief (feature list taken from App Store description and release history) | n/a | supplied | Feature scope only |

No screenshots, recordings, colour values, font metrics or animation timings came from any
reference. Two help-centre summaries conflict on drag location ("Workout tab", the current
article, vs "dashboard homepage", an older one). We followed the current article and did not
merge the two designs.

Help-centre articles cited through search summaries:
- "How does progressive overload work in the BWS+ app?" (zendesk 48277847253659)
- "How much weight should I be using?"
- "How do I adjust my workout schedule or move my workout to a different day?" / "How do I make changes to my workout week?" (42473198362267)
- "How does the rest timer work?"
- "How do I log my food?" (39277906032539), "How do I create my own meals into the app?" (39278076464411), "What if I want to log food that isn't in our database?" (39278408692251)
- "How does the Nutrition Check-In work?" (42921140542107), "How does the app calculate and adjust my calorie goal during the Nutrition Check-In?" (43511186060059)
- "Can I change the start of the week from Sunday to Monday?" (42238450953755)
- "How do I reset the app or restart progress?" (39415559141403)

## 2. Requirement classification

V = visually verified · D = documented behaviour (R2/R3) · U = unverified (our assumption)

| Area | Requirement | Class | Implementation |
|---|---|---|---|
| Shell | Dashboard, Workout, Nutrition areas exist | D | Tab bar `src/App.tsx` |
| Shell | Tab order, labels, icons, Progress tab, profile/AI/Lessons entry points | U | Guessed. Dashboard header holds Coach and Profile; Lessons card sits on the Dashboard |
| Shell | All colours, type, spacing, radii, icons, motion | U | Neutral tokens in `src/styles.css` |
| Dashboard | Start workouts from calendar and daily checklist | D | `Dashboard.tsx`, `WorkoutLauncher.tsx` |
| Dashboard | Week view expands to full calendar (pull down) | D | Swipe down/up on the card, or the grabber button |
| Dashboard | Current and previous weeks completable; future weeks not | D | `canLogWeek` in `domain/schedule.ts` |
| Dashboard | Existing session offers "Resume Workout" | D | Launcher sheet |
| Dashboard | Greeting, checklist items (food, weigh-in, steps), nutrition card, lesson card, check-in card | U | Composition guessed |
| Workout | Workout tab shows the current week | D | `WorkoutTab.tsx` |
| Workout | Press and drag a day to move it | D | Pointer drag on the handle (swaps days); also "Move to another day" |
| Workout | Scheduling-conflict warning for similar muscles back-to-back | D (exact rule U) | Provisional rule: 2+ shared muscle groups |
| Workout | Three-dot menu: Delete Workout → delete permanently or Save to Workout Library | D | Implemented |
| Workout | Swap Workout picks a day from program/library entries | D | Implemented |
| Workout | Additions, deletions and swaps propagate to future weeks; history is kept | D | Versioned `programVersions` plus session snapshots |
| Workout | Rename days (advanced customisation) | D | "Rename Day" |
| Workout | "Customize Program" menu next to This Week's Schedule | D (contents U) | Menu offers Library and Add |
| Supersets | Grouped display, swap via alternatives or browse, "Superset With", removing a member breaks that part of the pairing | D | `domain/items.ts`, Session and TemplateEditor |
| Rest timer | Exercise-specific defaults; saved user overrides; change from the active exercise card; superset has its own rest | D | `resolveRest` / `restPrefs` |
| Rest timer | Rest can be extended or stopped; shortening below the minimum is discouraged | D | ±15, Skip, warning below default |
| Rest timer | Default values, picker style, placement, alert sound, background behaviour | U | Placeholders |
| Progression | Ceiling reached → increase weight, reduce reps; within range → keep weight, add reps; below minimum → reduce weight, add reps; uses previous week; no cues for bodyweight | D | `domain/progression.ts` |
| Progression | Increments, rounding, set aggregation, missed-day suppression | U | No numbers shown. Aggregation: all sets at the ceiling = increase; any set below the minimum = decrease |
| Set types | Warmup, dropset, deload | D (R3) | Set menu |
| History | Editable exercise history; personal records | D (R3) | `ExerciseHistory.tsx`; past sessions editable |
| Nutrition | Plus on a meal → Foods / Meals; create named meal with ingredients and servings; totals | D | `AddFood.tsx`, `MealEditor.tsx` |
| Nutrition | Custom → Create new food (macros, calories, optional barcode) | D | `CustomFood.tsx` |
| Nutrition | Quick log of macros | D | Quick Add (micronutrients not yet) |
| Nutrition | Calories and protein per meal by default; gear setting adds carbs and fats; daily totals always visible | D (labels U) | `Nutrition.tsx` |
| Nutrition | Barcode scan, meal-photo AI, text description | D (R3) | BarcodeDetector + Open Food Facts; Claude vision/text |
| Nutrition | Meal copying, duplication | D (R3) | Copy slot to date/meal; Duplicate meal |
| Check-in | Shows weekly average weight change, pace vs Weight Pacer, average calories; any logged day counts; locked 7 days after completion | D | `domain/checkin.ts` |
| Check-in | Calorie formula, 90-day weighting, confidence level | U, undisclosed | Not implemented. The user sets the new target |
| Progress | Weight, workouts, nutrition, steps insights; backdated photos; weight-rate customisation | D (R3) | `Progress.tsx`, Profile → Weight Pacer |
| Week start | Sunday/Monday configurable | D | Onboarding and Profile |
| Reset | App progress cannot be reset | D | Kept as a clearly labelled development control (deviation) |
| Onboarding | Covers fitness level, goals, lifestyle | D (questions U) | 8 steps |
| AI coach | Fitness/nutrition assistant using personal data | D (entry, prompts, model, data U) | Independent Claude-backed server; shared data is shown to the user |

## 3. Screen inventory and route/state matrix

Tab bar is hidden on routes marked ✕.

| Route | Screen | Tab bar | Action → result | Persisted change |
|---|---|---|---|---|
| `/onboarding` | Assessment (8 steps + review) | ✕ | Start my plan → `/` | profile, assessment, target v1, program, templates, programVersion, weigh-in |
| `/` | Dashboard | ✓ | Day tap → select date · grabber or swipe → month grid · checklist workout → start → `/session/:id`, or sheet (Resume Workout / View / Not available yet / Discard other active) · Weigh in → sheet · Steps → sheet · nutrition card → `/nutrition?date=` · check-in card → `/nutrition/checkin` · Lessons → `/lessons` · chat → `/coach` · user → `/profile` | session + sets; weigh-in (one per day); steps |
| `/workout` | This Week's Schedule | ✓ | drag handle / Move to → swap days · ⋯ → Start, Swap Workout, Edit Exercises, Move, Rename Day, Delete Workout (Save to Library / Delete Permanently) · rest day → Add Workout / Create new | new programVersion effective this week (future weeks inherit); template.inLibrary; template delete only if unreferenced |
| `/workout/library` | Workout Library | ✓ | + → new template → editor · trash → remove from library | templates |
| `/workout/template/:id` | Edit Workout | ✕ | rename · add, swap (Alternatives/Browse), Superset With, Remove from Superset, edit sets/reps, remove | template.items (future sessions only) |
| `/session/:id` | Active / completed workout | ✕ | edit weight/reps · ✓ set → rest starts (superset: after last member) · rest ±15 / Skip · timer icon → duration picker (saved override, reset) · set index → type / delete · ⋯ → Swap, Superset With, Remove from Superset, Rest Timer, History, Remove · Finish → completed · ⋯ header → Discard | sets, session.rest (endsAt survives reload), restPrefs, session items + template |
| `/nutrition` | Food Log | ✓ | ◀ ▶ date · gear → carbs/fats toggle · + → `/nutrition/add/:date/:slot` · entry → servings/delete · ⋯ → copy meal to date/slot · scale → check-in | foodLog, profile.showCarbsFats |
| `/nutrition/add/:date/:slot` | Add food (Foods, Meals, Custom, Quick Add, Scan) | ✕ | pick → servings → Log · Create Meal · Create new food · Scan: Barcode (camera/manual → OFF), Meal photo, Describe → editable estimate → Log | foodLog (macros snapshotted), foods (OFF cache) |
| `/nutrition/meal/:id` | Create/Edit Meal | ✕ | name, ingredients with servings, live totals, Save, Duplicate, Delete | meals |
| `/nutrition/food/new` | Create Food | ✕ | Save (duplicate barcode check) | foods |
| `/nutrition/checkin` | Nutrition Check-In | ✕ | Complete Check-In → `/nutrition`; locked view for 7 days | checkins, new target (effective today) |
| `/progress` | Weight, Workouts, Nutrition, Steps, Photos | ✓ | log/edit/delete weigh-ins (backdated) · sessions → `/session/:id` · exercise → history · photos add (backdated)/view/delete | weighins, steps, photos |
| `/progress/exercise/:id` | Exercise history + PRs | ✓ | edit set → PRs recompute | sets |
| `/lessons` | Lessons (empty: content gap) | ✓ | — | — |
| `/coach` | AI Coach | ✕ | send · retry · new chat · history (open/delete) · "See exactly what's shared" | chats, chatMessages |
| `/profile` | Profile & Settings | ✓ | units, week start, pacer, step goal, targets, reminder, appearance, export, delete data | profile, targets |

Loading, empty, error and offline states: every screen shows a spinner while loading and an
empty state where relevant. When offline, a banner appears; IndexedDB writes still work; AI
and barcode features show a specific offline message. Camera permission denied, no barcode
support, product not found, AI not configured (503), refused (422), rate-limited (429) and
server errors each show a message, with a Retry button where a retry makes sense.

## 4. Journeys validated (Playwright, 390×844, `tests/e2e/journeys.spec.ts`)

1. Onboarding → first workout → log set → **reload** (state and rest timer persist) → leave → dashboard "Resume Workout" → saved rest override → finish → **history edit updates PR**.
2. Food entry → totals; documented meal-creation flow → totals; quick add; gear toggle; persistence across reload.
3. Weigh-ins → check-in → **target changes** on the Food Log → check-in locked.
4. Delete to Workout Library → re-add; calendar expansion; future-week workout blocked.
5. AI coach shows a "not configured" error, not a fabricated reply.

Unit tests (`tests/unit`) cover progression rules, superset pairing and breaking, schedule
versioning (propagates forward, past weeks unchanged), check-in maths and lock, session
resume, and derived totals.

## 5. Results

### Visual parity: **unverified, 0 screens verified**
No reference captures, so no overlay or diff comparison was possible. Implementation captures
at 390×844 @2x are in `docs/screenshots/` for comparison once reference captures exist.

### Behavioural parity: **documented behaviour implemented; exact behaviour unverified**
Every D-row above works and persists. Behaviour beyond the documentation (menu wording, picker
behaviour, timer alerts, onboarding questions, dashboard composition) is our assumption.

### Unresolved service, content and algorithm gaps
- **Algorithms (undisclosed):** workout generator (we use fixed split templates), TDEE and
  initial targets (we use a labelled Mifflin-St Jeor estimate), check-in calorie adjustment and
  confidence level, recomposition detector, muscle prioritisation, progression increments and
  rounding, missed-day suppression rule, rest defaults per exercise.
- **Content:** BWS exercise library and tutorial videos, food database, lessons, imagery,
  brand assets and fonts. Seed data is generic and labelled as such.
- **Services:** subscriptions and restore and membership gating (no billing; status shown as
  "unverified"), BWS accounts and authentication, cloud sync, US grocery prices,
  international label OCR (barcode lookup via Open Food Facts only), recipe URL import and
  sharing, micronutrients, cardio/rehab/assisted exercise types, workout shortening,
  achievement sharing, push notifications for reminders.
- **Platform (web build):** Apple Health / Health Connect, Apple Watch live sync, iOS Live
  Activities, and background timers are not available. Rest end time is persisted, and a
  Notification fires when the page is hidden and permission is granted.
- **AI coach:** a real connected feature only when `ANTHROPIC_API_KEY` is set on the server.
  It is an independent Claude implementation, not BWS's prompts or model.

## 6. References still needed for literal parity

Same-version (record the app version) screen recordings and screenshots of:
fresh install, onboarding branches, authentication, paywall · every tab and every profile/settings subsection ·
workout generation, preview, customisation, exercise selection, supersets · a full active workout including set
editing, effort entry, timers, interruption, resumption, completion · food search, serving edits, every scanner
mode, custom foods, meals, recipes, check-ins · all Progress views, filters, history edits, photo flows, weight
logging · lessons, exercise videos, AI conversations and their menus · Health permissions, notification
settings, subscription restoration, offline use, error states · Watch and lock-screen behaviour — plus light and
dark appearance at a fixed device size, the exact tab bar, and the BWS font and colour specification.
