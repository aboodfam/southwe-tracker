# Adaptive Today and starter templates

This release adds editable daily starter templates, a main action on Today,
manual adjustment of routine tasks and habits, repeated-friction suggestions,
a welcoming return after seven days away, and a rolling seven-day review.

## Behaviour

- Four ready templates plus a custom-action path. Preview, rename, change
  estimates/timing, remove actions, and edit optional smaller steps before saving.
- Templates create recurring routine actions using the existing routine system.
  They do not create calendar appointments or one-off tasks with deadlines.
- Starting an action records a place to return to; it does not mark it complete.
- Adjustments apply only to the current local date. Keep an action, take a smaller
  first step, or pause its current occurrence. Original recurring plans and totals
  are unchanged. Pausing is explicitly not rescheduling.
- Smaller-step completion is stored separately from full task/habit completion.
- Version checks prevent stale adjustment drafts and Undo from overwriting newer
  changes. Reopen the adjustment panel after a version conflict.
- Friction suggestions require adjustments on three distinct dates in the last
  fourteen days. Missing logs are not failures. Dismissal lasts until new evidence;
  quiet mode suppresses the proactive suggestion.
- The review covers the seven complete days before today, with the preceding
  seven days for comparison. It counts distinct days with logged progress and
  separates smaller steps. It does not infer why an activity was missed.
- A saved experiment appears on Today for seven days. A user can optionally
  update a recurring routine's time when saving the review.
- Existing workout logging, saved-day locking, Athkar, and progress totals remain
  intact. Unfinished tasks in locked routine days are still shown as unfinished.

## Data and deployment

The schema adds `supportDays`, `supportVisits`, and `weeklyReviews`. Routine tasks
gain optional time/fallback metadata. Version-1 plan transfers accept optional
`taskDetails` and still read earlier exports. Account deletion includes the new
tables. Existing records require no destructive migration.

Deploy the Convex schema and functions together with this frontend. Publishing
only the frontend would leave the new API calls unavailable. This local checkout
had no `CONVEX_DEPLOYMENT` configuration during implementation; no production
deployment, production login, or real-account mutation was performed. Connect
the intended development deployment before live integration testing. The normal
Convex code-generation command regenerates the checked-in API types then.

## Verification

- `npm test`: 15 isolated Convex tests covering authentication, cross-account
  ownership, transactional template retries, invalid inputs, day scoping,
  version conflicts/Undo, return detection, friction evidence, review counts,
  export/import metadata, and account deletion.
- `npm run build`: project security checks, TypeScript checks, production bundle.
- Desktop/mobile browser interaction checks against a separate sample-data
  fixture, including template exclusion, step completion/Undo, review saving,
  pause/restore, and horizontal overflow. These do not replace live-backend QA.

Automatic deadline scheduling, workout-volume adaptation, and automatic changes
to ongoing habit targets are outside this release. They need a richer scheduling
model and reviewed workout alternatives.
