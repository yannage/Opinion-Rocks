# Daily question source and operating contract

Audit date: October 19, 2026. Repository baseline: `0984b3e192a24fdc3816d8dbd37e9f9be5ff45b6`.

This document describes the verified production path and completed content consolidation. On October 19, 2026, all 86 remaining approved questions were atomically imported and independently read back in full. This does not certify the unpublished `daily_reset` implementation or enforce calendar dates.

## One source for each stage

| Stage | Authority | Consumers |
| --- | --- | --- |
| Future question content and order | Supabase `public.question_queue` | The existing reset function; editorial verification |
| Published current question and cycle | Latest `public.daily_state` row, ordered by `id DESC` | Website, social preparation/publication, live checks |
| Plans, evidence and discussion | Trello cards and this runbook | Editors and operators; these are mirrors, not independent publishing inputs |

Never publish a social question directly from a document, calendar file, or Trello card. Read the live `daily_state`, verify it against the intended activated queue entry, and use its exact question. If they disagree, stop that day's promotion and investigate. Do not overwrite a question already accepting answers to make a plan match.

The frontend does not select from a local question list. `index.html`'s `loadDailyTopic()` reads:

```text
GET /rest/v1/daily_state?select=*&order=id.desc&limit=1
```

It displays `current_topic`. A failed or empty response displays a retry message and disables submission; it does not substitute another question. The page refreshes this state on load, before submission, when returning to a visible tab, and every 60 seconds while visible. `dailyCycleKey()` uses `date`, `updated_at`, and `current_topic`, so a midday edit changes the frontend's perceived cycle and clears its same-session rock/share state.

## Evidence and limits

- On October 19, backend logs showed a Tines user agent invoking `POST /daily_reset`, version 6, at approximately 04:00 UTC with HTTP 200.
- The observed unused-question selection was `is_used=false`, ordered by `priority DESC, created_at ASC`, limit 1.
- The independently checked public Data API returned HTTP 200 at `2026-10-19T16:06:49Z`, with `date=2026-10-19`, `current_topic=What’s a small thing that irrationally annoys you?`, and `updated_at=2026-10-19T04:00:04.461`.
- Production HTML returned HTTP 200 and exactly matched the repository baseline, SHA-256 `5254e8212ace511ef6bc04cb9ef6f78f1ef16210f1c64ceac82b7ce0787a75cb`.
- The repository currently contains the static website and tests, but no deployed reset source, Supabase migration history, or scheduler configuration. The observed request and queue query do not reveal the function's complete transaction, deletion, retry, or exhaustion behavior.
- A fresh database check confirmed cron job 1, `daily-topic-reset`, schedule `0 0 * * *`, remains inactive. One observed Tines caller is not proof that no other caller exists.

These checks read question/configuration data only. They do not require reading visitor opinions or invoking the reset function.

## Completed calendar consolidation

The 86 approved future entries for October 20, 2026–January 13, 2027 are now in the existing queue as IDs 41–126. The first candidate is ID 41, “What should your phone stop asking you?”. All questions, priorities, categories and notes matched the import payload on a separate readback. All 33 preexisting rows and today’s published row were unchanged. The four elapsed calendar dates were not inserted. No reset was invoked and no scheduler was changed.

The import transaction checked the complete pre-import queue and current-state snapshots under short-lived locks, rejected priority conflicts or duplicate IDs, required exactly 86 inserts, and verified the complete first-86 selection before commit. A separate readback confirmed the same result. The procedure below is retained for auditing; do not rerun the initial import.

Each imported row uses:

- `category = 'editorial_90_day'`
- `is_used = false`
- Unique descending `priority` values from `10000` through `9915`
- The exact approved question text
- Structured JSON in the existing `notes` field, with the following keys:

| Key | Meaning |
| --- | --- |
| `plan_key` | Exactly `opinion-rocks-2026-q4-v1` |
| `expected_cycle_date` | Intended cycle label, `YYYY-MM-DD`; metadata, not a scheduling constraint |
| `original_plan_day` | Original day number in the 90-day calendar, 5 through 90 |
| `kind` | Question kind carried from the approved calendar |
| `source_card` | Actual source calendar card URL |
| `imported_on` | Exactly `2026-10-19` for this initial import |

The existing 14 unused priority-zero questions remain unchanged as legacy reserves. They are lower-priority content, not another active calendar. Do not falsely mark them used, delete them, or claim they cannot eventually be selected after the approved entries are exhausted.

The expected dates are not enforced by the current selector. Priorities provide order only. A duplicate reset, missed reset, manual invocation, or unknown function behavior could shift the sequence. A dated and idempotent publisher remains separate follow-up work after source recovery.

### Atomic import and verification

1. Re-read the current state and unused queue immediately before importing. Check that today's published row and the expected reserve rows have not changed. Check for any existing rows with this plan key and for priorities that would precede or collide with the proposed range.
2. Prepare all 86 rows once. Validate the dates, priorities, unique plan/date markers, exact question text, and required note fields locally. Do not add new schema, permissions, credentials, schedules, or functions for this content import.
3. Use one short database transaction with appropriate locking/preconditions. Abort if the live-state/queue snapshot differs, the plan already exists, or a conflict is found. Do not run competing import processes. Do not import near the observed reset window.
4. Insert the batch once and retain the returned IDs plus complete row values as the import receipt. Confirm exactly 86 inserts before commit. A network error or ambiguous response is a reason to read back the plan, not to repeat the insert blindly.
5. Read back the entire plan in the actual selector order. Verify every question/date/priority/notes field, all 86 rows, the October 20 head, the January 13 tail, and unchanged reserve rows. Verify that today's `daily_state` remains byte-for-byte equivalent for the checked fields.
6. Mirror the verified queue in Trello and the operating task. Keep the import receipt with the project evidence. Do not mark dated activation or reset idempotence verified by a successful content import.

Never invoke `daily_reset` to test this import. It may reset the day's participation. Rollback must target only the exact inserted IDs and values that are still unused, and requires a fresh state check. Do not bulk-delete by category or plan key after any row has activated.

## Read-only checks

Run with an authorized database connection. Do not publish service keys or scheduler request secrets in logs, documentation, or Trello. These statements inspect no visitor opinions.

```sql
BEGIN TRANSACTION READ ONLY;

-- Same latest-row choice as the website, restricted to question/cycle fields.
SELECT id, date, current_topic, updated_at
FROM public.daily_state
ORDER BY id DESC
LIMIT 1;

-- Exact observed reset ordering. The first result is the next candidate.
SELECT id, question, priority, created_at, category, notes
FROM public.question_queue
WHERE is_used = false
ORDER BY priority DESC, created_at ASC
LIMIT 100;

-- Operational counts only; this does not verify individual imported values.
SELECT category, priority, is_used, count(*) AS row_count
FROM public.question_queue
GROUP BY category, priority, is_used
ORDER BY category, priority DESC, is_used;

ROLLBACK;
```

Compare the ordered result against the exact import receipt. Do not use count-only verification as proof of correct questions, dates, or priorities. If more than 100 unused rows exist, deliberately extend the readback rather than silently accepting a truncated queue.

For scheduler inventory, inspect `cron.job`'s `jobid`, `jobname`, `schedule`, and `active` fields where available. Avoid printing complete SQL commands or HTTP headers because they may contain credentials. Inspect the actual Tines story and its timezone/retry settings through supported access; do not assume the observed user agent reveals all those settings.

## Daily distribution gate

1. Read the live `daily_state`; require a valid date, nonempty question, and valid cycle timestamp.
2. Match the published question to its intended plan entry and expected cycle date. Check for skipped or duplicate activation. After an unexpected change, record the mismatch and pause promotion; never repair today's question automatically.
3. Read the next unused queue row using `priority DESC, created_at ASC`. Treat that row as the next planned question. Trello and draft previews must mirror it.
4. Build each social post from the verified live question and current-cycle destination link. Keep per-platform destination/cycle publication receipts to prevent duplicates. Recheck the live cycle before sending anything prepared earlier.
5. Record the live cycle, next queue ID, mismatch/blocker if any, and per-channel outcomes. Missing account access or failed publication is not a successful post.

The first calendar activation is expected on October 20 but has not yet been observed. Actual verification after the reset is required before counting a baseline day. Do not claim the entire 90-day plan has been live merely because its future entries are queued.

## Future editorial replacements

Edit an existing future row; do not insert a second candidate for the same date. Re-read the exact target immediately before editing and require all of the following to match: its ID, `is_used=false`, its old question, and its complete old notes. Also preserve the expected date, plan key, original plan day, and priority. A topical replacement may update its question, kind, and source evidence while retaining the same queue identity.

Use a short transaction and a conditional update equivalent to this parameterized pattern. This is a review pattern, not an executable script with real parameters:

```sql
UPDATE public.question_queue
SET question = :new_question,
    notes = :new_notes
WHERE id = :expected_id
  AND is_used = false
  AND question = :expected_old_question
  AND notes IS NOT DISTINCT FROM :expected_old_notes
  AND priority = :expected_priority
RETURNING id, question, priority, is_used, category, notes;
```

Require exactly one returned row and read it back before committing/recording success. Zero rows means another process changed or activated it; stop and investigate. Never substitute a looser predicate, update the current `daily_state`, or insert another row to work around a failed comparison. Do not edit close to the activation window while reset concurrency remains unaudited.

## Unresolved activation work

- Recover and version the deployed `daily_reset` source, then inspect queue consumption, current-row updates, cleanup order, transaction boundaries, repeat calls, partial failures, and exhaustion behavior.
- Verify the sole active scheduler and its retries. Do not create a second cron or retire the existing trigger based only on historical notes.
- Resolve timezone policy explicitly. Fixed `04:00 UTC` is midnight Eastern during daylight time and 11 p.m. on the previous Eastern date after the November 1 DST transition. The queue's date metadata does not change that behavior.
- Only after the implementation is understood, design and test date-based activation and same-cycle idempotence without exposing historical opinions. Preserve the current day and use a nonproduction fixture for reset tests.

No change to today's published state, reset source, scheduler, access policy, or visitor data is part of the content-consolidation procedure above.
