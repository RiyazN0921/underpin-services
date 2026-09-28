# Bug Report

Found by reading the source and confirming each one with a test. All eight bugs are fixed and covered by tests.

| #   | Area                                   | Status |
| --- | -------------------------------------- | ------ |
| 1   | Pagination offset                      | Fixed  |
| 2   | Status filter (substring match)        | Fixed  |
| 3   | `complete` resets priority             | Fixed  |
| 4   | `GET /tasks` query handling            | Fixed  |
| 5   | `PUT` mass assignment                  | Fixed  |
| 6   | Re-completing overwrites `completedAt` | Fixed  |
| 7   | Validator gaps                         | Fixed  |
| 8   | Error handler / 404                    | Fixed  |

---

## #1 Pagination skips the first page

- **Where:** `getPaginated` in `src/services/taskService.js`
- **Expected:** `?page=1&limit=10` returns items 1-10.
- **Actual:** returns items 11-20 (page 1 is empty on a 10-item list).
- **Why:** `offset = page * limit` treats page as 0-based, but the route defaults `page` to 1 and the API is 1-based.
- **Found by:** reading the route defaults against the service, then a test creating 15 tasks and asserting page 1 starts at the first one.
- **Fix:** `offset = (page - 1) * limit`.

## #2 Status filter uses substring matching

- **Where:** `getByStatus` in `src/services/taskService.js`
- **Expected:** `?status=todo` returns only `todo` tasks, and an unknown status returns nothing.
- **Actual:** `?status=in` matches `in_progress`; `?status=o` matches `todo` and `done`.
- **Why:** `t.status.includes(status)` is `String.prototype.includes`, a substring test, not equality.
- **Found by:** code reading, confirmed by a test asserting `?status=in` returns `[]`.
- **Fix:** `t.status === status`.

## #3 Completing a task resets its priority

- **Where:** `completeTask` in `src/services/taskService.js`
- **Expected:** completing changes only `status` and `completedAt`.
- **Actual:** `priority` is forced to `'medium'`, so a `high` task loses its priority.
- **Why:** the updated object hard-codes `priority: 'medium'` after the spread of the existing task.
- **Found by:** a test that creates a `high` task, completes it, and checks priority.
- **Fix:** removed the hard-coded `priority` line.

## #4 `GET /tasks` query handling

- **Where:** `router.get('/')` in `src/routes/tasks.js`
- **Expected:** `status` and pagination compose; invalid `page` / `limit` are rejected.
- **Actual:**
  - `?status=done&page=2` returns early on `status` and ignores pagination.
  - `page=-1` or `limit=-5` are passed straight to `slice`, giving odd results.
  - `limit=0` silently becomes 10 because of `parseInt(limit) || 10`.
- **Why:** an early `return` in the status branch, and `parseInt(...) || default` treats every falsy or invalid value as "use the default" without validating.
- **Found by:** code reading, then tests for combined filters and invalid values.
- **Fix:** validate `page` / `limit` as positive integers (400 otherwise), and pass `status` into `getPaginated` so both apply.

## #5 `PUT /tasks/:id` allows mass assignment

- **Where:** `update` in `src/services/taskService.js`
- **Expected:** clients can change only user-editable fields.
- **Actual:** `{ ...task, ...fields }` lets a request overwrite `id`, `createdAt`, `completedAt`, or add arbitrary keys.
- **Why:** the raw request body is spread over the stored task with no whitelist.
- **Found by:** code reading, then a test sending `{ id, createdAt, completedAt, hack }` and checking they are ignored.
- **Fix:** whitelist `title`, `description`, `status`, `priority`, `dueDate`; everything else is dropped. `completedAt` is now derived from status: set when a task moves to `done`, cleared when it moves back out, and untouched otherwise.

## #6 Re-completing a task overwrites `completedAt`

- **Where:** `completeTask` in `src/services/taskService.js`
- **Expected:** completing an already-done task is idempotent.
- **Actual:** each call replaces the original completion time.
- **Why:** the function always builds a new `completedAt` without checking the current status.
- **Found by:** code reading, then a test using fake timers to complete twice at different times.
- **Fix:** if the task is already `done`, return it unchanged (200).

## #7 Validator gaps

- **Where:** `src/utils/validators.js`
- **Expected:** invalid values are rejected.
- **Actual:**
  - Truthy checks (`body.status && ...`) skip empty strings and `null`, so `status: ""` passes and `status: null` is stored.
  - `description` is never type-checked, so `description: 123` is stored.
  - `dueDate: 123` passes because `Date.parse` coerces numbers to strings.
- **Why:** truthiness was used as a stand-in for "was provided".
- **Found by:** code reading, then tests posting each bad value.
- **Fix:** check `!== undefined` instead of truthiness, type-check `description` and `dueDate`, allow `dueDate: null` to clear a date, and reject non-object bodies. Create and update now share one validation function.

## #8 Malformed JSON returns 500; unknown routes return HTML

- **Where:** error middleware in `src/app.js`
- **Expected:** malformed JSON is a client error (400); unknown routes return a JSON 404.
- **Actual:** the catch-all handler returns 500 for everything, including the `SyntaxError` (status 400) thrown by `express.json()`. Unknown routes get Express's default HTML 404.
- **Why:** the handler ignores `err.status`, and there is no 404 handler.
- **Found by:** sending a broken JSON body in a test.
- **Fix:** honor 4xx `err.status` / `err.statusCode` values and add a JSON 404 fallback.

---

## Documentation mismatch (not a code bug)

The README task shape lists `pending | in-progress | completed`, but the code and `ASSIGNMENT.md` use `todo | in_progress | done`. I followed the code.
