# ISSUE.md — ScrapeGoat Local Upload Error Handling Must Hard-Fail Before Submit

## Non-Negotiable Orchestrator Rules

**READ THIS ISSUE FILE FIRST. THEN RE-READ THIS ISSUE FILE BEFORE EVERY PHASE. DO NOT GUESS. DO NOT SKIP. DO NOT FAKE RESULTS.**

- [ ] **NO SUBTASKS! USE SUBAGENTS!**
- [ ] **NO SUBTASKS! USE SUBAGENTS!** The Orchestrator must launch independent SubAgents for investigation, implementation, UI validation, backend validation, and final verification.
- [ ] Use `sequential-thinking` before planning, before implementation, before testing, and before final reporting.
- [ ] Add reminders constantly while working. Add reminders before each gate so the Orchestrator does not drift from this issue.
- [ ] Re-read `ISSUE.md` before each phase, before each code change, before each test run, and before final report.
- [ ] Keep every error string, log line, UI message, job status, timestamp, file path, UUID, and JSON payload from the evidence section exact.
- [ ] Deploy ScrapeGoat locally and prove the fix through real browser testing with `stealth-browser-mcp`.
- [ ] Use the repo test files for real-world validation:
  - `./test-files/TestArchive-2057Files.zip`
  - `./test-files/TestDocument-15MB.pdf`
- [ ] Do not claim success unless the browser, UI state, backend logs, job queue, and library state all prove success.
- [ ] Do not bypass the WebUI. API-only testing is not enough.
- [ ] Do not mark complete until the final manual gate is passed.

---

## Summary

ScrapeGoat local documentation upload error handling is still broken.

Two failure classes are currently allowed to proceed too far:

1. A document that exceeds the maximum file size is accepted into the job flow, then incorrectly completes as a successful indexing job with `Pages: 0` and `Chunks: 0`.
2. An archive that exceeds the maximum archive file count still populates the import tree, allows `Accept & Submit`, starts an ingestion job, and only fails later inside the worker.

This must be fixed at the upload/import-tree validation layer and enforced again at submission/backend validation. Invalid files or invalid archives must never enter the pending import tree, must never enable `Accept & Submit`, and must never enqueue an ingestion job.

**READ THIS ISSUE FILE AGAIN BEFORE IMPLEMENTING. NO SUBTASKS! USE SUBAGENTS! USE `sequential-thinking`. ADD REMINDERS CONSTANTLY.**

---

## Root Requirement

Invalid local upload inputs must hard-fail before submission.

The WebUI must reject invalid local files and invalid archives immediately and cleanly. The invalid upload must not create a pending import-tree item. If the import tree is empty, `Accept & Submit` must remain disabled. The backend must also reject invalid upload sessions and prevent ingestion jobs from being queued.

The correct behavior is:

- [ ] Oversized documents are rejected immediately.
- [ ] Oversized documents are not added to the import tree.
- [ ] Archives exceeding maximum file count are rejected immediately.
- [ ] Archives exceeding maximum file count do not partially populate the import tree.
- [ ] Invalid uploads keep `Accept & Submit` disabled when no valid files remain.
- [ ] Invalid upload sessions cannot be submitted.
- [ ] Invalid upload sessions cannot enqueue jobs.
- [ ] Invalid upload sessions cannot create empty libraries.
- [ ] Invalid upload sessions cannot produce successful zero-page / zero-chunk library entries.
- [ ] Errors shown in the WebUI are clear, direct, and actionable.
- [ ] Backend validation matches frontend validation.
- [ ] Worker-side validation remains as a defensive fallback, but must not be the first place this failure is caught.

**READ THIS ISSUE FILE AGAIN AFTER READING THIS SECTION. NO SUBTASKS! USE SUBAGENTS!**

---

## Required Repo Test Files

The ScrapeGoat repo now includes real-world test files that must be used during validation:

```text
./test-files/TestArchive-2057Files.zip
./test-files/TestDocument-15MB.pdf
```

These are mandatory validation assets.

- [ ] `TestDocument-15MB.pdf` must be used to validate maximum document file size rejection.
- [ ] `TestArchive-2057Files.zip` must be used to validate archive file count rejection.
- [ ] Both files must be tested through the real WebUI using `stealth-browser-mcp`.
- [ ] Both files must be tested after deploying ScrapeGoat locally from the working branch.
- [ ] Both files must be tested after all code changes are complete.
- [ ] Both files must be tested again after any fix to the fix.

**Do not substitute fake files unless these repo files are unavailable. If they are unavailable, stop and report that as a blocker. Do not fake the test.**

---

## Mandatory SubAgent Plan

The Orchestrator must not implement this as a single linear task. The Orchestrator must use SubAgents.

**NO SUBTASKS! USE SUBAGENTS!**

Launch SubAgents in parallel where possible. Give each SubAgent full instructions, full context, and the path to `ISSUE.md`. Every SubAgent must be instructed to re-read `ISSUE.md` before reporting.

### Required SubAgents

- [ ] **SubAgent 01 — Upload Flow Investigation**
  - Find the frontend upload/import-tree code path.
  - Find where file-size validation is performed.
  - Find where archive extraction and archive file-count validation are performed.
  - Find where invalid files are added to the import tree.
  - Find where `Accept & Submit` is enabled.
  - Re-read `ISSUE.md` before final notes.

- [ ] **SubAgent 02 — Backend Validation Investigation**
  - Find upload session APIs.
  - Find submit/enqueue APIs.
  - Find local import staging/session validation.
  - Find where invalid upload sessions can still enqueue jobs.
  - Find where empty libraries can be created.
  - Re-read `ISSUE.md` before final notes.

- [ ] **SubAgent 03 — Implementation SubAgent**
  - Apply the smallest correct fix.
  - Do not rewrite working code.
  - Add frontend validation where required.
  - Add backend validation where required.
  - Ensure invalid archive extraction is atomic: all-or-nothing, never partial tree population.
  - Re-read `ISSUE.md` before final notes.

- [ ] **SubAgent 04 — Automated Test SubAgent**
  - Add or update unit/integration tests for oversized document rejection.
  - Add or update unit/integration tests for archive file-count rejection.
  - Add or update tests proving invalid upload sessions cannot submit jobs.
  - Add or update tests proving empty import trees keep submit disabled.
  - Re-read `ISSUE.md` before final notes.

- [ ] **SubAgent 05 — Real Browser Validation SubAgent**
  - Deploy ScrapeGoat locally.
  - Use `stealth-browser-mcp` to test the WebUI.
  - Upload `./test-files/TestDocument-15MB.pdf`.
  - Upload `./test-files/TestArchive-2057Files.zip`.
  - Capture browser observations, UI state, visible errors, job queue state, and library state.
  - Re-read `ISSUE.md` before final notes.

- [ ] **SubAgent 06 — Final Verification SubAgent**
  - Independently verify the fix after all changes.
  - Do not trust the implementation SubAgent.
  - Do not trust the browser validation SubAgent.
  - Re-run the mandatory real-world tests.
  - Confirm no regression to valid local uploads or remote URL ingestion.
  - Re-read `ISSUE.md` before final notes.

### SubAgent Rule Repetition

- [ ] **NO SUBTASKS! USE SUBAGENTS!**
- [ ] Prepare SubAgent instructions before launching them.
- [ ] Launch all planned SubAgents in a single task where possible so they run in parallel.
- [ ] Every SubAgent must use `sequential-thinking` for its own work.
- [ ] Every SubAgent must add reminders constantly.
- [ ] Every SubAgent must explicitly state that it re-read `ISSUE.md` before reporting.
- [ ] The Orchestrator must reject any SubAgent report that does not prove it followed this issue.

---

## Manual Gate 0 — Read, Think, Remind

This gate must be completed before any code is changed.

- [ ] Read `ISSUE.md` from top to bottom.
- [ ] Use `sequential-thinking` to restate the problem.
- [ ] Add reminders for:
  - re-reading `ISSUE.md`
  - using SubAgents only
  - testing with `stealth-browser-mcp`
  - using both repo test files
  - preserving exact error evidence
- [ ] Identify the likely frontend, backend, worker, and test areas.
- [ ] Launch required SubAgents.
- [ ] Do not edit code before SubAgents complete investigation or provide enough evidence to proceed.

**Manual approval required:** The Orchestrator must write a brief Gate 0 summary and explicitly state that `ISSUE.md` was re-read.

**READ THIS ISSUE FILE AGAIN BEFORE MOVING TO GATE 1. NO SUBTASKS! USE SUBAGENTS!**

---

## Manual Gate 1 — Reproduce Current Broken Behavior Locally

Deploy ScrapeGoat locally from the current branch before applying the fix.

The Orchestrator must determine the repo’s actual local deployment method. Do not invent commands if the repo already provides documented commands. Use the repo’s README, compose files, package scripts, and existing developer workflow.

Required local deployment checklist:

- [ ] Install dependencies using the repo-supported method.
- [ ] Start required services using the repo-supported local workflow.
- [ ] Confirm WebUI is reachable in a browser.
- [ ] Confirm worker/backend services are running.
- [ ] Confirm logs are accessible.
- [ ] Confirm job queue is visible.
- [ ] Confirm libraries list is visible.
- [ ] Confirm test files exist:
  - [ ] `./test-files/TestArchive-2057Files.zip`
  - [ ] `./test-files/TestDocument-15MB.pdf`

Required reproduction via `stealth-browser-mcp`:

- [ ] Open the local ScrapeGoat WebUI.
- [ ] Start Add New Documentation flow.
- [ ] Select Local Documentation.
- [ ] Upload `./test-files/TestDocument-15MB.pdf`.
- [ ] Observe whether it is incorrectly accepted.
- [ ] Observe whether it incorrectly enables or allows `Accept & Submit`.
- [ ] Submit only when reproducing the existing broken behavior on the baseline branch.
- [ ] Record whether it creates a successful zero-page / zero-chunk library.
- [ ] Repeat with `./test-files/TestArchive-2057Files.zip`.
- [ ] Record whether it partially populates the import tree.
- [ ] Record whether it allows `Accept & Submit`.
- [ ] Record whether it enqueues a job and fails later.

**Manual approval required:** The Orchestrator must summarize the reproduced failures and confirm they match the exact evidence below before implementing.

**READ THIS ISSUE FILE AGAIN BEFORE MOVING TO GATE 2. NO SUBTASKS! USE SUBAGENTS!**

---

## Manual Gate 2 — Implement the Fix

Implementation must be surgical and must preserve working behavior.

### Fix Requirements

- [ ] Reject oversized documents before they enter the import tree.
- [ ] Reject archives that exceed maximum file count before they enter the import tree.
- [ ] Archive extraction must be atomic from the UI/session perspective.
  - [ ] If archive validation fails, no extracted files from that archive remain in the pending tree.
  - [ ] If archive validation fails, no virtual folders from that archive remain in the pending tree.
  - [ ] If archive validation fails, no stale upload-session state remains submit-ready.
- [ ] The import tree summary must not count rejected files.
- [ ] The import tree summary must not show partial archive contents after a rejected archive.
- [ ] `Accept & Submit` must be disabled when there are no valid accepted files.
- [ ] `Accept & Submit` must not submit a session containing validation errors that block ingestion.
- [ ] Backend submit/enqueue endpoint must reject invalid or empty upload sessions.
- [ ] Backend submit/enqueue endpoint must return a useful error instead of enqueuing a doomed worker job.
- [ ] Worker must still defensively reject invalid inputs, but this must be a fallback only.
- [ ] Invalid uploads must never create a library.
- [ ] Invalid uploads must never create a completed job.
- [ ] Invalid uploads must never create a zero-page / zero-chunk success state.

### Required Error Behavior

For `./test-files/TestDocument-15MB.pdf`:

- [ ] WebUI shows an error about document exceeding maximum file size.
- [ ] File is not added to the import tree.
- [ ] Import tree remains empty when no other valid files exist.
- [ ] `Accept & Submit` remains disabled.
- [ ] No job is queued.
- [ ] No library is added.

For `./test-files/TestArchive-2057Files.zip`:

- [ ] WebUI shows an error: `Archive exceeds Maximum file count!`
- [ ] No files from the archive are added to the import tree.
- [ ] No folders from the archive are added to the import tree.
- [ ] Import tree remains empty when no other valid files exist.
- [ ] `Accept & Submit` remains disabled.
- [ ] No job is queued.
- [ ] No library is added.

### Implementation Rules

- [ ] Re-read `ISSUE.md` before modifying code.
- [ ] Use `sequential-thinking` before modifying code.
- [ ] Add reminders before modifying code.
- [ ] Use SubAgents for implementation review.
- [ ] Do not introduce broad rewrites.
- [ ] Do not bypass current architecture.
- [ ] Do not hide errors.
- [ ] Do not convert hard failures into warnings.
- [ ] Do not allow partial invalid archive state to survive.
- [ ] Do not rely only on frontend validation.
- [ ] Do not rely only on backend validation.

**Manual approval required:** The Orchestrator must summarize exactly what changed and why it fixes both failures.

**READ THIS ISSUE FILE AGAIN BEFORE MOVING TO GATE 3. NO SUBTASKS! USE SUBAGENTS!**

---

## Manual Gate 3 — Automated Tests

Automated tests must prove the fix at the lowest practical layers.

Required test checklist:

- [ ] Oversized PDF upload is rejected.
- [ ] Oversized PDF does not appear in pending import tree/session state.
- [ ] Oversized PDF cannot be submitted.
- [ ] Oversized PDF does not enqueue a job.
- [ ] Oversized PDF does not create a library.
- [ ] Archive exceeding maximum file count is rejected.
- [ ] Archive exceeding maximum file count does not partially populate session state.
- [ ] Archive exceeding maximum file count does not partially populate the import tree.
- [ ] Archive exceeding maximum file count cannot be submitted.
- [ ] Archive exceeding maximum file count does not enqueue a job.
- [ ] Empty upload session submit is rejected.
- [ ] Submit button disabled state is covered where frontend testing allows it.
- [ ] Valid local upload still works.
- [ ] Valid archive under limits still works.
- [ ] Existing Remote URL ingestion still works or is covered by regression testing.

Test rules:

- [ ] Re-read `ISSUE.md` before writing tests.
- [ ] Use `sequential-thinking` before selecting test boundaries.
- [ ] Add reminders before running tests.
- [ ] Do not delete failing tests to get green.
- [ ] Do not weaken assertions.
- [ ] Do not mock away the validation behavior being tested.
- [ ] Do not call implementation complete without test evidence.

**Manual approval required:** The Orchestrator must provide the test command results and explain any skipped tests.

**READ THIS ISSUE FILE AGAIN BEFORE MOVING TO GATE 4. NO SUBTASKS! USE SUBAGENTS!**

---

## Manual Gate 4 — Local Deployment After Fix

Deploy ScrapeGoat locally after applying the fix.

The deployment must use the actual repo workflow.

Required checklist:

- [ ] Stop any old local ScrapeGoat instance.
- [ ] Clean stale local state that could hide the bug, using only safe repo-supported cleanup steps.
- [ ] Start ScrapeGoat locally from the fixed branch.
- [ ] Confirm WebUI loads.
- [ ] Confirm backend is reachable.
- [ ] Confirm worker is running.
- [ ] Confirm job queue updates are working.
- [ ] Confirm no stale job or library from the old failed tests pollutes the result.
- [ ] Confirm both test files are present in `./test-files/`.

**Manual approval required:** The Orchestrator must state the local URL tested and confirm the fixed branch is deployed.

**READ THIS ISSUE FILE AGAIN BEFORE MOVING TO GATE 5. NO SUBTASKS! USE SUBAGENTS!**

---

## Manual Gate 5 — `stealth-browser-mcp` Real-World Browser Testing

This gate is mandatory. Do not replace it with API calls. Do not replace it with unit tests. Do not replace it with screenshots from memory.

Use `stealth-browser-mcp` against the locally deployed ScrapeGoat WebUI.

### Browser Test A — Oversized PDF

Use:

```text
./test-files/TestDocument-15MB.pdf
```

Steps:

- [ ] Open the local ScrapeGoat WebUI with `stealth-browser-mcp`.
- [ ] Click `Add New Documentation`.
- [ ] Select the Local Documentation flow.
- [ ] Upload `./test-files/TestDocument-15MB.pdf`.
- [ ] Confirm a maximum-file-size error is shown.
- [ ] Confirm the file is not added to the import tree.
- [ ] Confirm the import tree is empty if no valid files were added.
- [ ] Confirm `Accept & Submit` is disabled.
- [ ] Confirm clicking or forcing submit is not possible through the normal UI.
- [ ] Confirm no job appears in the Job Queue.
- [ ] Confirm no library is added.
- [ ] Confirm backend logs do not show an enqueued job for this invalid upload.

Expected result:

- [ ] WebUI blocks the upload cleanly.
- [ ] No import-tree item exists.
- [ ] No submit is possible.
- [ ] No job is queued.
- [ ] No library is created.

### Browser Test B — Archive Exceeds Maximum File Count

Use:

```text
./test-files/TestArchive-2057Files.zip
```

Steps:

- [ ] Open the local ScrapeGoat WebUI with `stealth-browser-mcp`.
- [ ] Click `Add New Documentation`.
- [ ] Select the Local Documentation flow.
- [ ] Upload `./test-files/TestArchive-2057Files.zip`.
- [ ] Confirm the WebUI shows: `Archive exceeds Maximum file count!`
- [ ] Confirm no archive contents are added to the import tree.
- [ ] Confirm no folders are added to the import tree.
- [ ] Confirm the import tree summary does not show `999 Files` from the rejected archive.
- [ ] Confirm the import tree is empty if no valid files were added.
- [ ] Confirm `Accept & Submit` is disabled.
- [ ] Confirm no job appears in the Job Queue.
- [ ] Confirm no library is added.
- [ ] Confirm backend logs do not show an enqueued job for this invalid upload.

Expected result:

- [ ] WebUI blocks the archive cleanly.
- [ ] No partial archive tree remains.
- [ ] No submit is possible.
- [ ] No job is queued.
- [ ] No library is created.

### Browser Test C — Valid Upload Regression

Use any existing small valid supported document from the repo, or create a tiny temporary Markdown file if the repo has no valid small fixture.

- [ ] Upload a valid small file through Local Documentation.
- [ ] Confirm it appears in the import tree.
- [ ] Confirm `Accept & Submit` enables.
- [ ] Submit it.
- [ ] Confirm job queues.
- [ ] Confirm job completes successfully.
- [ ] Confirm library is created with non-zero useful content where applicable.

### Browser Test D — Remote URL Regression

- [ ] Test existing Remote URL source flow.
- [ ] Confirm source selection still works.
- [ ] Confirm Remote URL panel still opens correctly.
- [ ] Confirm local-upload validation changes did not break remote ingestion UI.

### `stealth-browser-mcp` Reporting Requirements

The browser validation report must include:

- [ ] Local URL tested.
- [ ] Browser steps performed.
- [ ] Visible WebUI errors.
- [ ] Import tree state after upload.
- [ ] `Accept & Submit` state.
- [ ] Job Queue state.
- [ ] Library list state.
- [ ] Backend/worker log observations.
- [ ] Explicit pass/fail for each checklist item.

**Manual approval required:** The Orchestrator must provide the real browser validation report. No report means no completion.

**READ THIS ISSUE FILE AGAIN BEFORE MOVING TO GATE 6. NO SUBTASKS! USE SUBAGENTS!**

---

## Manual Gate 6 — Final Independent Verification

This gate must be performed by a separate SubAgent or a fresh verification pass that did not implement the fix.

**NO SUBTASKS! USE SUBAGENTS!**

- [ ] Re-read `ISSUE.md`.
- [ ] Use `sequential-thinking`.
- [ ] Add reminders before verification.
- [ ] Re-run automated tests.
- [ ] Re-run `stealth-browser-mcp` tests for both mandatory files.
- [ ] Verify no job is queued for invalid uploads.
- [ ] Verify no library is created for invalid uploads.
- [ ] Verify no completed zero-page / zero-chunk success exists for oversized PDF.
- [ ] Verify no partial archive import tree exists for over-limit archive.
- [ ] Verify valid local upload still works.
- [ ] Verify Remote URL flow still works.
- [ ] Verify logs support the claimed behavior.

**Manual approval required:** The final verifier must explicitly state PASS or FAIL. Any failure returns the issue to Gate 2.

---

## Acceptance Criteria

The issue is complete only when every item below is true.

- [ ] `./test-files/TestDocument-15MB.pdf` is rejected by the WebUI before submission.
- [ ] `./test-files/TestDocument-15MB.pdf` is not added to the import tree.
- [ ] `./test-files/TestDocument-15MB.pdf` cannot be submitted.
- [ ] `./test-files/TestDocument-15MB.pdf` does not enqueue a job.
- [ ] `./test-files/TestDocument-15MB.pdf` does not create a library.
- [ ] `./test-files/TestDocument-15MB.pdf` does not create a successful `Pages: 0 / Chunks: 0` library.
- [ ] `./test-files/TestArchive-2057Files.zip` shows `Archive exceeds Maximum file count!`.
- [ ] `./test-files/TestArchive-2057Files.zip` does not add extracted files to the import tree.
- [ ] `./test-files/TestArchive-2057Files.zip` does not add folders to the import tree.
- [ ] `./test-files/TestArchive-2057Files.zip` does not show `999 Files` after rejection.
- [ ] `./test-files/TestArchive-2057Files.zip` cannot be submitted.
- [ ] `./test-files/TestArchive-2057Files.zip` does not enqueue a job.
- [ ] `./test-files/TestArchive-2057Files.zip` does not create a library.
- [ ] Backend submit/enqueue rejects invalid or empty upload sessions.
- [ ] Frontend and backend validation agree.
- [ ] Worker-side validation remains defensive but is not the primary failure point.
- [ ] Valid local uploads still work.
- [ ] Existing Remote URL ingestion still works.
- [ ] Automated tests pass.
- [ ] Local deployment was performed.
- [ ] `stealth-browser-mcp` real-world browser testing was performed.
- [ ] Final independent verification passed.

**READ THIS ISSUE FILE AGAIN BEFORE CLOSING. NO SUBTASKS! USE SUBAGENTS!**

---

## Definition of Done

- [ ] Code fix implemented.
- [ ] Tests added or updated.
- [ ] Tests passing.
- [ ] ScrapeGoat deployed locally from fixed branch.
- [ ] `stealth-browser-mcp` tested both mandatory files.
- [ ] Evidence confirms invalid uploads cannot submit.
- [ ] Evidence confirms invalid uploads cannot queue jobs.
- [ ] Evidence confirms invalid uploads cannot create libraries.
- [ ] Evidence confirms valid local upload still works.
- [ ] Evidence confirms Remote URL flow still works.
- [ ] Final report includes exact commands, test results, and browser observations.
- [ ] Final report states which SubAgents were used.
- [ ] Final report confirms `ISSUE.md` was re-read before final verification.

**NO SUBTASKS! USE SUBAGENTS! READ THIS ISSUE FILE AGAIN BEFORE WRITING THE FINAL REPORT.**

---

# Exact Error Evidence — Do Not Modify

The following evidence is preserved from the original issue. Do not edit these logs, error messages, timestamps, file paths, UUIDs, or JSON payloads.

# Error Handling still not working!!


## Example 1 - Document exceeds Maximum file size

Upload 15MB Document to WebUI
no error
adds File to Job list
click Accept & Submit
WebUI Immediately finishes
Reports Successfully indexed Job
Library Added, Pages: 0 / Chunks: 0 / Last Update: N/A

## What should have happened

Upload 15MB Document to WebUI
WebUi shows error about Document exceeding Maximum File Size
15MB Document NOT added File to Job list
Because Import Tree empty, "Accept & Submit" button still disabled
Cannot Submit Empty Job.

### Details


#### WebUI Job Queue
```
Job Queue
Clear Completed Jobs
test-15MB_doc 1

Last Indexed: 6/9/2026, 1:37:38 PM
Successfully indexed
```

#### Library Added;
```
test-15mb_doc
file:///import/test-15MB_doc/1/
1
Pages: 0
Chunks: 0
Last Update: N/A
```

#### Backend Log;
```
scrapegoat-web     | Received remote event: JOB_STATUS_CHANGE
scrapegoat-web     | Event emitted: JOB_STATUS_CHANGE
scrapegoat-web     | SSE forwarding event: job-status-change {"id":"37d1f3f6-b322-4ab0-ab08-527c8b288346","library":"test-15MB_doc","version":"1","status":"queued","error":null,"createdAt":"2026-06-09T13:37:38.932Z","startedAt":null,"finishedAt":null,"sourceUrl":"file:///import/test-15MB_doc/1/"}
scrapegoat-web     | Received remote event: LIBRARY_CHANGE
scrapegoat-worker  | 📝 Job enqueued: 37d1f3f6-b322-4ab0-ab08-527c8b288346 for test-15MB_doc@1
scrapegoat-worker  | Stored scraper options for test-15MB_doc@1: file:///import/test-15MB_doc/1/
scrapegoat-worker  | Event emitted: JOB_STATUS_CHANGE
scrapegoat-worker  | Event emitted: LIBRARY_CHANGE
scrapegoat-worker  | Job 37d1f3f6-b322-4ab0-ab08-527c8b288346 status changed to: queued
scrapegoat-worker  | Event emitted: JOB_STATUS_CHANGE
scrapegoat-worker  | Event emitted: LIBRARY_CHANGE
scrapegoat-worker  | Job 37d1f3f6-b322-4ab0-ab08-527c8b288346 status changed to: running
scrapegoat-worker  | [37d1f3f6-b322-4ab0-ab08-527c8b288346] Worker starting job for test-15MB_doc@1
scrapegoat-worker  | 🗑️ Removing all documents from test-15MB_doc@1 store
scrapegoat-worker  | 🗑️ Deleted 0 documents
scrapegoat-worker  | Event emitted: LIBRARY_CHANGE
scrapegoat-worker  | 💾 Cleared store for test-15MB_doc@1 before scraping.
scrapegoat-worker  | Using strategy "LocalImportStrategy" for URL: file:///import/test-15MB_doc/1/
scrapegoat-worker  | Found 1 entries in import directory: /data/staging/upl_4d68f495-8786-4ad9-944f-594905eb6e39
scrapegoat-worker  | Selected DocumentPipeline for content type "application/pdf" (/data/staging/upl_4d68f495-8786-4ad9-944f-594905eb6e39/Dell Poweredge T630 Owners Manual.pdf)
scrapegoat-worker  | Document exceeds size limit (13638370 > 10485760): file:///import/test-15MB_doc/1/Dell%20Poweredge%20T630%20Owners%20Manual.pdf
scrapegoat-worker  | Processing error for /data/staging/upl_4d68f495-8786-4ad9-944f-594905eb6e39/Dell Poweredge T630 Owners Manual.pdf: Document exceeds maximum size of 10485760 bytes
scrapegoat-worker  | 📄 Scraping page 1/2 (depth 1/3): file:///import/test-15MB_doc/1/Dell%20Poweredge%20T630%20Owners%20Manual.pdf
scrapegoat-worker  | Event emitted: JOB_PROGRESS
scrapegoat-worker  | Job 37d1f3f6-b322-4ab0-ab08-527c8b288346 progress: 1/2 pages
scrapegoat-worker  | 📚 Adding processed content: Dell Poweredge T630 Owners Manual.pdf
scrapegoat-worker  | ⚠️  No chunks in processed content for file:///import/test-15MB_doc/1/Dell%20Poweredge%20T630%20Owners%20Manual.pdf. Skipping.
scrapegoat-worker  | [37d1f3f6-b322-4ab0-ab08-527c8b288346] Stored processed content: file:///import/test-15MB_doc/1/Dell%20Poweredge%20T630%20Owners%20Manual.pdf
scrapegoat-worker  | ⚠️  Job 37d1f3f6-b322-4ab0-ab08-527c8b288346 error (1 total) on document file:///import/test-15MB_doc/1/Dell%20Poweredge%20T630%20Owners%20Manual.pdf: Document exceeds maximum size of 10485760 bytes
scrapegoat-worker  | [37d1f3f6-b322-4ab0-ab08-527c8b288346] Worker finished job successfully.
scrapegoat-worker  | ⚠️  Job 37d1f3f6-b322-4ab0-ab08-527c8b288346 completed with 1 document errors out of 2 total pages
scrapegoat-worker  | Event emitted: JOB_STATUS_CHANGE
scrapegoat-worker  | Event emitted: LIBRARY_CHANGE
scrapegoat-worker  | Job 37d1f3f6-b322-4ab0-ab08-527c8b288346 status changed to: completed
scrapegoat-worker  | ✅ Job completed (with errors): 37d1f3f6-b322-4ab0-ab08-527c8b288346
scrapegoat-worker  | 🧹 Cleaned up staging directory: /data/staging/upl_4d68f495-8786-4ad9-944f-594905eb6e39
scrapegoat-server  | Received remote event: JOB_STATUS_CHANGE
scrapegoat-server  | Event emitted: JOB_STATUS_CHANGE
scrapegoat-server  | Received remote event: LIBRARY_CHANGE
scrapegoat-server  | Event emitted: LIBRARY_CHANGE
scrapegoat-server  | Received remote event: JOB_STATUS_CHANGE
scrapegoat-server  | Event emitted: JOB_STATUS_CHANGE
scrapegoat-server  | Received remote event: LIBRARY_CHANGE
scrapegoat-server  | Event emitted: LIBRARY_CHANGE
scrapegoat-server  | Received remote event: LIBRARY_CHANGE
scrapegoat-server  | Event emitted: LIBRARY_CHANGE
scrapegoat-server  | Received remote event: JOB_PROGRESS
scrapegoat-server  | Event emitted: JOB_PROGRESS
scrapegoat-server  | Received remote event: JOB_STATUS_CHANGE
scrapegoat-server  | Event emitted: JOB_STATUS_CHANGE
scrapegoat-server  | Received remote event: LIBRARY_CHANGE
scrapegoat-server  | Event emitted: LIBRARY_CHANGE
scrapegoat-web     | Event emitted: LIBRARY_CHANGE
scrapegoat-web     | SSE forwarding event: library-change {}
scrapegoat-web     | Job 37d1f3f6-b322-4ab0-ab08-527c8b288346 enqueued successfully
scrapegoat-web     | 📦 Import job enqueued: 37d1f3f6-b322-4ab0-ab08-527c8b288346 for test-15MB_doc@1
scrapegoat-web     | Received remote event: JOB_STATUS_CHANGE
scrapegoat-web     | Event emitted: JOB_STATUS_CHANGE
scrapegoat-web     | SSE forwarding event: job-status-change {"id":"37d1f3f6-b322-4ab0-ab08-527c8b288346","library":"test-15MB_doc","version":"1","status":"running","error":null,"createdAt":"2026-06-09T13:37:38.932Z","startedAt":null,"finishedAt":null,"sourceUrl":"file:///import/test-15MB_doc/1/"}
scrapegoat-web     | Received remote event: LIBRARY_CHANGE
scrapegoat-web     | Event emitted: LIBRARY_CHANGE
scrapegoat-web     | SSE forwarding event: library-change {}
scrapegoat-web     | Received remote event: LIBRARY_CHANGE
scrapegoat-web     | Event emitted: LIBRARY_CHANGE
scrapegoat-web     | SSE forwarding event: library-change {}
scrapegoat-web     | Received remote event: JOB_PROGRESS
scrapegoat-web     | Event emitted: JOB_PROGRESS
scrapegoat-web     | SSE forwarding event: job-progress {"id":"37d1f3f6-b322-4ab0-ab08-527c8b288346","library":"test-15MB_doc","version":"1","progress":{"pagesScraped":1,"totalPages":2,"totalDiscovered":2,"currentUrl":"file:///import/test-15MB_doc/1/Dell%20Poweredge%20T630%20Owners%20Manual.pdf","depth":1,"maxDepth":3}}
scrapegoat-web     | Received remote event: JOB_STATUS_CHANGE
scrapegoat-web     | Event emitted: JOB_STATUS_CHANGE
scrapegoat-web     | SSE forwarding event: job-status-change {"id":"37d1f3f6-b322-4ab0-ab08-527c8b288346","library":"test-15MB_doc","version":"1","status":"completed","error":null,"createdAt":"2026-06-09T13:37:38.932Z","startedAt":"2026-06-09T13:37:38.965Z","finishedAt":null,"sourceUrl":"file:///import/test-15MB_doc/1/"}
scrapegoat-web     | Received remote event: LIBRARY_CHANGE
scrapegoat-web     | Event emitted: LIBRARY_CHANGE
scrapegoat-web     | SSE forwarding event: library-change {}
```




---------


## Example 2 - Archive File Count exceeds Maximum Archive File Count Limit


Upload Archive with More than (Max Archive File Count) Files to WebUI
Shows Error (below)
Shows Warning (below)
adds all Files in Archive to to Import Tree
Shows 999 Files (Max Archive File Count) and 4.2 MB Total Size (Total Archive File Size) 0 Folders in Import Tree Summary
click Accept & Submit
WebUI Immediately finishes
Reports Indexing Failed Job (error below: `WebUI Job Queue Error`)
Library Not Added, but didnt stop the job from proceeding first!

## What should have happened

Upload Archive with More than (Max Archive File Count) Files to WebUI
Shows Error - `Archive exceeds Maximum file count!`
No files added File to Job list
Because Import Tree empty, "Accept & Submit" button still disabled
Cannot Submit Empty Job.


### Details

#### Import Tree File List before Accept and Submit
```
999 Files
4.2 MB Total Size
0 Folders
```

#### WebUI Error
```
Some files failed to upload:
Rogue Trader - Source Books (Markdown).zip — Maximum file count reached (999) for session upl_53833384-5443-4cd1-ba51-39e6e8dbde8e
```

#### WebUI Warning
```
1 file(s) failed to upload:
Rogue Trader - Source Books (Markdown).zip — Maximum file count reached (999) for session upl_53833384-5443-4cd1-ba51-39e6e8dbde8e
```

#### WebUI Virtual Upload Folder
```
Rogue Trader - Battlefleet Koronus
Rogue Trader - Battlefleet Koronus - Page 0031.md  3.6 KB
Rogue Trader - Battlefleet Koronus - Page 0001.md  115 B
Rogue Trader - Battlefleet Koronus - Page 0029.md  5.4 KB
Rogue Trader - Battlefleet Koronus - Page 0002.md  140 B
Rogue Trader - Battlefleet Koronus - Page 0030.md  4.7 KB
**<removed 4000+ entries for example>**
Rogue Trader - Hostile Acquisitions - Page 0112.md 6.4 KB
```

#### WebUI Log downloaded
```
# ScrapeGoat — Files that failed to upload
# Session: upl_53833384-5443-4cd1-ba51-39e6e8dbde8e
# Library: test-Over999FileZip v1
# Generated: 2026-06-09T13:50:21.039Z

Rogue Trader - Source Books (Markdown).zip	Maximum file count reached (999) for session upl_53833384-5443-4cd1-ba51-39e6e8dbde8e
```

#### WebUI Job Queue Error
```
test-Over999FileZip 1

Last Indexed: 6/9/2026, 1:50:20 PM

Error:
Local import file not found: /data/staging/upl_53833384-5443-4cd1-ba51-39e6e8dbde8e/Rogue Trader - Battlefleet Koronus - Page 0001.md. The file may not have been extracted from the archive.

                                          Indexing failed
                                                    Error
```

#### Backend Log
```
scrapegoat-web     | Received remote event: JOB_STATUS_CHANGE
scrapegoat-web     | Event emitted: JOB_STATUS_CHANGE
scrapegoat-web     | SSE forwarding event: job-status-change {"id":"445048f3-3e12-4ab2-b49a-fd991f939df7","library":"test-Over999FileZip","version":"1","status":"queued","error":null,"createdAt":"2026-06-09T13:50:20.186Z","startedAt":null,"finishedAt":null,"sourceUrl":"file:///import/test-Over999FileZip/1/"}
scrapegoat-web     | Received remote event: LIBRARY_CHANGE
scrapegoat-web     | Event emitted: LIBRARY_CHANGE
scrapegoat-web     | SSE forwarding event: library-change {}
scrapegoat-web     | Job 445048f3-3e12-4ab2-b49a-fd991f939df7 enqueued successfully
scrapegoat-web     | 📦 Import job enqueued: 445048f3-3e12-4ab2-b49a-fd991f939df7 for test-Over999FileZip@1
scrapegoat-web     | Received remote event: JOB_STATUS_CHANGE
scrapegoat-web     | Event emitted: JOB_STATUS_CHANGE
scrapegoat-web     | SSE forwarding event: job-status-change {"id":"445048f3-3e12-4ab2-b49a-fd991f939df7","library":"test-Over999FileZip","version":"1","status":"running","error":null,"createdAt":"2026-06-09T13:50:20.186Z","startedAt":null,"finishedAt":null,"sourceUrl":"file:///import/test-Over999FileZip/1/"}
scrapegoat-web     | Received remote event: LIBRARY_CHANGE
scrapegoat-server  | Received remote event: JOB_STATUS_CHANGE
scrapegoat-server  | Event emitted: JOB_STATUS_CHANGE
scrapegoat-server  | Received remote event: LIBRARY_CHANGE
scrapegoat-server  | Event emitted: LIBRARY_CHANGE
scrapegoat-server  | Received remote event: JOB_STATUS_CHANGE
scrapegoat-server  | Event emitted: JOB_STATUS_CHANGE
scrapegoat-server  | Received remote event: LIBRARY_CHANGE
scrapegoat-server  | Event emitted: LIBRARY_CHANGE
scrapegoat-server  | Received remote event: LIBRARY_CHANGE
scrapegoat-server  | Event emitted: LIBRARY_CHANGE
scrapegoat-worker  | 📝 Job enqueued: 445048f3-3e12-4ab2-b49a-fd991f939df7 for test-Over999FileZip@1
scrapegoat-worker  | Stored scraper options for test-Over999FileZip@1: file:///import/test-Over999FileZip/1/
scrapegoat-worker  | Event emitted: JOB_STATUS_CHANGE
scrapegoat-worker  | Event emitted: LIBRARY_CHANGE
scrapegoat-worker  | Job 445048f3-3e12-4ab2-b49a-fd991f939df7 status changed to: queued
scrapegoat-worker  | Event emitted: JOB_STATUS_CHANGE
scrapegoat-worker  | Event emitted: LIBRARY_CHANGE
scrapegoat-worker  | Job 445048f3-3e12-4ab2-b49a-fd991f939df7 status changed to: running
scrapegoat-worker  | [445048f3-3e12-4ab2-b49a-fd991f939df7] Worker starting job for test-Over999FileZip@1
scrapegoat-worker  | 🗑️ Removing all documents from test-Over999FileZip@1 store
scrapegoat-worker  | 🗑️ Deleted 0 documents
scrapegoat-worker  | Event emitted: LIBRARY_CHANGE
scrapegoat-worker  | 💾 Cleared store for test-Over999FileZip@1 before scraping.
scrapegoat-worker  | Using strategy "LocalImportStrategy" for URL: file:///import/test-Over999FileZip/1/
scrapegoat-worker  | Found 8 entries in import directory: /data/staging/upl_53833384-5443-4cd1-ba51-39e6e8dbde8e
scrapegoat-web     | Event emitted: LIBRARY_CHANGE
scrapegoat-web     | SSE forwarding event: library-change {}
scrapegoat-web     | Received remote event: LIBRARY_CHANGE
scrapegoat-web     | Event emitted: LIBRARY_CHANGE
scrapegoat-web     | SSE forwarding event: library-change {}
scrapegoat-worker  | Found 146 entries in import directory: /data/staging/upl_53833384-5443-4cd1-ba51-39e6e8dbde8e/Rogue Trader - Battlefleet Koronus
scrapegoat-worker  | Found 146 entries in import directory: /data/staging/upl_53833384-5443-4cd1-ba51-39e6e8dbde8e/Rogue Trader - Edge of the Abyss
scrapegoat-worker  | Found 13 entries in import directory: /data/staging/upl_53833384-5443-4cd1-ba51-39e6e8dbde8e/Rogue Trader - Epoch-Koronus
scrapegoat-worker  | Found 146 entries in import directory: /data/staging/upl_53833384-5443-4cd1-ba51-39e6e8dbde8e/Rogue Trader - Faith and Coin
scrapegoat-worker  | Found 34 entries in import directory: /data/staging/upl_53833384-5443-4cd1-ba51-39e6e8dbde8e/Rogue Trader - Game Master's Kit
scrapegoat-worker  | Found 401 entries in import directory: /data/staging/upl_53833384-5443-4cd1-ba51-39e6e8dbde8e/Rogue Trader - Core Rulebook (updated with 1.4 errata)
scrapegoat-worker  | Found 113 entries in import directory: /data/staging/upl_53833384-5443-4cd1-ba51-39e6e8dbde8e/Rogue Trader - Hostile Acquisitions
scrapegoat-worker  | Found 0 entries in import directory: /data/staging/upl_53833384-5443-4cd1-ba51-39e6e8dbde8e/__extract_1781012613685
scrapegoat-worker  | ⚠️  [445048f3-3e12-4ab2-b49a-fd991f939df7] Worker encountered error: ScraperError: Local import file not found: /data/staging/upl_53833384-5443-4cd1-ba51-39e6e8dbde8e/Rogue Trader - Battlefleet Koronus - Page 0001.md. The file may not have been extracted from the archive.
scrapegoat-worker  | Event emitted: JOB_STATUS_CHANGE
scrapegoat-worker  | Event emitted: LIBRARY_CHANGE
scrapegoat-worker  | Job 445048f3-3e12-4ab2-b49a-fd991f939df7 status changed to: failed
scrapegoat-worker  | ❌ Job failed: 445048f3-3e12-4ab2-b49a-fd991f939df7: ScraperError: Local import file not found: /data/staging/upl_53833384-5443-4cd1-ba51-39e6e8dbde8e/Rogue Trader - Battlefleet Koronus - Page 0001.md. The file may not have been extracted from the archive.
scrapegoat-worker  | Removing version: test-Over999FileZip@1
scrapegoat-worker  | 🗑️ Removed 0 documents
scrapegoat-worker  | 🗑️ Completely removed library test-Over999FileZip (was last version)
scrapegoat-worker  | Event emitted: LIBRARY_CHANGE
scrapegoat-worker  | 🧹 Cleaned up empty library/version: test-Over999FileZip@1
scrapegoat-worker  | 🧹 Cleaned up staging directory: /data/staging/upl_53833384-5443-4cd1-ba51-39e6e8dbde8e
scrapegoat-web     | Received remote event: JOB_STATUS_CHANGE
scrapegoat-web     | Event emitted: JOB_STATUS_CHANGE
scrapegoat-web     | SSE forwarding event: job-status-change {"id":"445048f3-3e12-4ab2-b49a-fd991f939df7","library":"test-Over999FileZip","version":"1","status":"failed","error":null,"createdAt":"2026-06-09T13:50:20.186Z","startedAt":"2026-06-09T13:50:20.203Z","finishedAt":null,"sourceUrl":"file:///import/test-Over999FileZip/1/"}
scrapegoat-web     | Received remote event: LIBRARY_CHANGE
scrapegoat-web     | Event emitted: LIBRARY_CHANGE
scrapegoat-web     | SSE forwarding event: library-change {}
scrapegoat-web     | Received remote event: LIBRARY_CHANGE
scrapegoat-web     | Event emitted: LIBRARY_CHANGE
scrapegoat-web     | SSE forwarding event: library-change {}
scrapegoat-server  | Received remote event: JOB_STATUS_CHANGE
scrapegoat-server  | Event emitted: JOB_STATUS_CHANGE
scrapegoat-server  | Received remote event: LIBRARY_CHANGE
scrapegoat-server  | Event emitted: LIBRARY_CHANGE
scrapegoat-server  | Received remote event: LIBRARY_CHANGE
scrapegoat-server  | Event emitted: LIBRARY_CHANGE
```


