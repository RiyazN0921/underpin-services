# Submission Notes

## Run it

```bash
cd task-api
npm install
npm start
npm test
npm run coverage
```

## What I did

- **Tests:** unit tests for `taskService.js` and Supertest integration tests for every route (`taskService.test.js`, `tasks.routes.test.js`). all passing, including tests for every fixed bug.
- **Bug report:** see [BUGS.md](./BUGS.md). Eight bugs found, all eight fixed.
- **Feature:** `PATCH /tasks/:id/assign`, with tests.

## Coverage (rerun `npm run coverage` and paste your latest summary; the numbers below are from before the last fixes)

```
All files        |   95.73 |    90.65 |   96.77 |   95.33
 app.js          |   77.77 |    66.66 |   66.66 |   77.77   (listen() block and the 500 branch)
 routes/tasks.js |     100 |      100 |     100 |     100
 taskService.js  |     100 |    95.23 |     100 |     100
 validators.js   |   90.32 |    88.09 |     100 |   90.32
```

## `PATCH /tasks/:id/assign` design decisions

Body: `{ "assignee": "string" }`. Returns the updated task.

- **Validation:** `assignee` must be a string, non-empty after trimming, and at most 100 characters. Otherwise 400.
- **Trimming:** the stored value is trimmed, so `"  Riyaz "` is saved as `"Riyaz"`.
- **Missing task:** 404.
- **Already assigned:** reassignment is allowed (200). A 409 would force an "unassign" step and this API has none. I'd confirm this rule with the team before shipping.
- **Order of checks:** body validation runs before the lookup, so a bad body on a nonexistent id returns 400, not 404. This keeps validation out of the service layer.
- **Task shape:** new tasks now include `assignee: null` so the field is always present.
- **Tradeoff:** `assignee` is free text, as specified. There is no user model, so nothing checks that the assignee exists.

## What I'd test next

- Whether `PUT` should reject protected fields like `id` with a 400 instead of silently ignoring them (I chose to ignore).
- Concurrent updates to the same task.
- Very large payloads (413) and unusual content types.
- Filtering combined with stats and overdue edge cases around the current time.

## What surprised me

- `completeTask` silently resets priority to `medium`, which looks like a leftover from a copy-paste rather than intent.
- The pagination bug is invisible in a unit test that passes `page` as 0, which is why testing through the route (which defaults to 1) mattered.
- Malformed JSON returned 500 rather than 400 because of the catch-all error handler.
- The README's status values do not match the code's.

## Questions I'd ask before shipping

- Persistence: what replaces the in-memory store, and what happens to data on deploy or restart?
- Auth and ownership: who may assign, edit, or delete which tasks?
- Should `assignee` reference real users, and should reassignment be allowed or restricted?
- Which status values are canonical: the README's or the code's?
- Is a maximum page size needed, so clients can't request `limit=1000000`?
- Rate limiting, request logging, and health-check endpoints for production.
