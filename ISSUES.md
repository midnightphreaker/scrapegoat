
# Issues - Main issue - WebUI and Backend needs improved Error Handling

## Example 1: Document exceeds Maximum File Size

Adding Document that exceeds Maximum File Size, WebUI processes and adds to Files and Folders list for Job.  Enables "Accept & Submit",  Allows "Accept & Submit".  Results in Backend process, create library for job, scans files for job, removes submitted file as it exceeds 10MB, no more files to add, job Completed = But, Empty library still in Database, and then WebUI loads from Database, shows Empty Library

### Library
```
test-document15mb
file:///import/Test-Document15MB/1.0.0/
1.0.0
Pages: 0
Chunks: 0
Last Update: N/A
```

### Scrapegoat Log
```
scrapegoat-worker  | 📝 Job enqueued: 5085bd67-22b4-4797-a8a9-8bf7cda8307e for Test-Document15MB@1.0.0
scrapegoat-worker  | Stored scraper options for Test-Document15MB@1.0.0: file:///import/Test-Document15MB/1.0.0/
scrapegoat-worker  | Event emitted: JOB_STATUS_CHANGE
scrapegoat-worker  | Event emitted: LIBRARY_CHANGE
scrapegoat-worker  | Job 5085bd67-22b4-4797-a8a9-8bf7cda8307e status changed to: queued
scrapegoat-worker  | Event emitted: JOB_STATUS_CHANGE
scrapegoat-worker  | Event emitted: LIBRARY_CHANGE
scrapegoat-worker  | Job 5085bd67-22b4-4797-a8a9-8bf7cda8307e status changed to: running
scrapegoat-worker  | [5085bd67-22b4-4797-a8a9-8bf7cda8307e] Worker starting job for Test-Document15MB@1.0.0
scrapegoat-worker  | 🗑️ Removing all documents from Test-Document15MB@1.0.0 store
scrapegoat-worker  | 🗑️ Deleted 0 documents
scrapegoat-worker  | Event emitted: LIBRARY_CHANGE
scrapegoat-worker  | 💾 Cleared store for Test-Document15MB@1.0.0 before scraping.
scrapegoat-worker  | Using strategy "LocalImportStrategy" for URL: file:///import/Test-Document15MB/1.0.0/
scrapegoat-worker  | Found 1 entries in import directory: /data/staging/upl_b14cb29d-6348-4868-93dd-1956db4dc153
scrapegoat-worker  | Selected DocumentPipeline for content type "application/pdf" (/data/staging/upl_b14cb29d-6348-4868-93dd-1956db4dc153/Dell Poweredge T630 Owners Manual.pdf)
scrapegoat-worker  | Document exceeds size limit (13638370 > 10485760): file:///import/Test-Document15MB/1.0.0/Dell%20Poweredge%20T630%20Owners%20Manual.pdf
scrapegoat-worker  | Processing error for /data/staging/upl_b14cb29d-6348-4868-93dd-1956db4dc153/Dell Poweredge T630 Owners Manual.pdf: Document exceeds maximum size of 10485760 bytes
scrapegoat-worker  | 📄 Scraping page 1/2 (depth 1/3): file:///import/Test-Document15MB/1.0.0/Dell%20Poweredge%20T630%20Owners%20Manual.pdf
scrapegoat-web     | Received remote event: JOB_STATUS_CHANGE
scrapegoat-web     | Event emitted: JOB_STATUS_CHANGE
scrapegoat-web     | SSE forwarding event: job-status-change {"id":"5085bd67-22b4-4797-a8a9-8bf7cda8307e","library":"Test-Document15MB","version":"1.0.0","status":"queued","error":null,"createdAt":"2026-06-08T03:58:30.767Z","startedAt":null,"finishedAt":null,"sourceUrl":"file:///import/Test-Document15MB/1.0.0/"}
scrapegoat-web     | Received remote event: LIBRARY_CHANGE
scrapegoat-web     | Event emitted: LIBRARY_CHANGE
scrapegoat-web     | SSE forwarding event: library-change {}
scrapegoat-web     | Job 5085bd67-22b4-4797-a8a9-8bf7cda8307e enqueued successfully
scrapegoat-web     | 📦 Import job enqueued: 5085bd67-22b4-4797-a8a9-8bf7cda8307e for Test-Document15MB@1.0.0
scrapegoat-web     | Received remote event: JOB_STATUS_CHANGE
scrapegoat-web     | Event emitted: JOB_STATUS_CHANGE
scrapegoat-web     | SSE forwarding event: job-status-change {"id":"5085bd67-22b4-4797-a8a9-8bf7cda8307e","library":"Test-Document15MB","version":"1.0.0","status":"running","error":null,"createdAt":"2026-06-08T03:58:30.767Z","startedAt":null,"finishedAt":null,"sourceUrl":"file:///import/Test-Document15MB/1.0.0/"}
scrapegoat-web     | Received remote event: LIBRARY_CHANGE
scrapegoat-web     | Event emitted: LIBRARY_CHANGE
scrapegoat-web     | SSE forwarding event: library-change {}
scrapegoat-web     | Received remote event: LIBRARY_CHANGE
scrapegoat-web     | Event emitted: LIBRARY_CHANGE
scrapegoat-web     | SSE forwarding event: library-change {}
scrapegoat-web     | Received remote event: JOB_PROGRESS
scrapegoat-web     | Event emitted: JOB_PROGRESS
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
scrapegoat-worker  | Event emitted: JOB_PROGRESS
scrapegoat-worker  | Job 5085bd67-22b4-4797-a8a9-8bf7cda8307e progress: 1/2 pages
scrapegoat-worker  | 📚 Adding processed content: Dell Poweredge T630 Owners Manual.pdf
scrapegoat-worker  | ⚠️  No chunks in processed content for file:///import/Test-Document15MB/1.0.0/Dell%20Poweredge%20T630%20Owners%20Manual.pdf. Skipping.
scrapegoat-worker  | [5085bd67-22b4-4797-a8a9-8bf7cda8307e] Stored processed content: file:///import/Test-Document15MB/1.0.0/Dell%20Poweredge%20T630%20Owners%20Manual.pdf
scrapegoat-worker  | [5085bd67-22b4-4797-a8a9-8bf7cda8307e] Worker finished job successfully.
scrapegoat-worker  | Event emitted: JOB_STATUS_CHANGE
scrapegoat-worker  | Event emitted: LIBRARY_CHANGE
scrapegoat-worker  | Job 5085bd67-22b4-4797-a8a9-8bf7cda8307e status changed to: completed
scrapegoat-worker  | ✅ Job completed: 5085bd67-22b4-4797-a8a9-8bf7cda8307e
scrapegoat-worker  | 🧹 Cleaned up staging directory: /data/staging/upl_b14cb29d-6348-4868-93dd-1956db4dc153
scrapegoat-web     | SSE forwarding event: job-progress {"id":"5085bd67-22b4-4797-a8a9-8bf7cda8307e","library":"Test-Document15MB","version":"1.0.0","progress":{"pagesScraped":1,"totalPages":2,"totalDiscovered":2,"currentUrl":"file:///import/Test-Document15MB/1.0.0/Dell%20Poweredge%20T630%20Owners%20Manual.pdf","depth":1,"maxDepth":3}}
scrapegoat-web     | Received remote event: JOB_STATUS_CHANGE
scrapegoat-web     | Event emitted: JOB_STATUS_CHANGE
scrapegoat-web     | SSE forwarding event: job-status-change {"id":"5085bd67-22b4-4797-a8a9-8bf7cda8307e","library":"Test-Document15MB","version":"1.0.0","status":"completed","error":null,"createdAt":"2026-06-08T03:58:30.767Z","startedAt":"2026-06-08T03:58:30.782Z","finishedAt":null,"sourceUrl":"file:///import/Test-Document15MB/1.0.0/"}
scrapegoat-web     | Received remote event: LIBRARY_CHANGE
scrapegoat-web     | Event emitted: LIBRARY_CHANGE
scrapegoat-web     | SSE forwarding event: library-change {}

```


## Example 2: Archive Exceeds Max File Count

Adding Archive file that has greater file count than Archive Maximum File Count Limit, WebUI proccesses and adds file names to Files and Folders in UI, Shows error saying Archive File Count is greater. But rejects uploading actual Archive file.  Enables "Accept & Submit",  Allows "Accept & Submit".  Results in Backend process, create library for job, scans files for job, scans for each file in the Files and Folders list submitted by WebUI, as WebUI rejected entire archive, files do not exist for Backend to scrape, no more files to add, job Failed = But, Empty library still in Database, and then WebUI loads from Database, shows Empty Library

### WebUI Error on upload

Shows `999 file(s) staged` on WebUI

Shows following error on WebUI
```
Some files failed to upload:
Rogue Trader - Source Books (Markdown).zip — Maximum file count reached (999) for session upl_39dce82b-8bc6-4456-b1e1-f08c19b84332
```

### Automated Error log download
```
# ScrapeGoat — Files that failed to upload
# Session: upl_bb42f0f2-9bd0-431d-a7f5-dd679335a34a
# Library: war2 v1.0.0
# Generated: 2026-06-08T03:56:02.495Z

Rogue Trader - Source Books (Markdown).zip	Maximum file count reached (999) for session upl_bb42f0f2-9bd0-431d-a7f5-dd679335a34a
```


### Job Queue Shows after Accept & Submit
```
Test-Archive4000Files 1.0.0

Last Indexed: 6/8/2026, 4:04:02 AM
Error:
Local import file not found: /data/staging/upl_39dce82b-8bc6-4456-b1e1-f08c19b84332/Rogue Trader - Battlefleet Koronus - Page 0001.md. The file may not have been extracted from the archive.
Indexing failed
Error
```

### Library
```
test-archive4000files
file:///import/Test-Archive4000Files/1.0.0/
1.0.0
Pages: 0
Chunks: 0
Last Update: N/A
```

### Scrapegoat log

```
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
scrapegoat-web     | Received remote event: JOB_STATUS_CHANGE
scrapegoat-web     | Event emitted: JOB_STATUS_CHANGE
scrapegoat-web     | SSE forwarding event: job-status-change {"id":"b37c78dc-2b3e-4f37-b0e1-e4a5af50621c","library":"Test-Archive4000Files","version":"1.0.0","status":"queued","error":null,"createdAt":"2026-06-08T04:04:02.242Z","startedAt":null,"finishedAt":null,"sourceUrl":"file:///import/Test-Archive4000Files/1.0.0/"}
scrapegoat-web     | Received remote event: LIBRARY_CHANGE
scrapegoat-web     | Event emitted: LIBRARY_CHANGE
scrapegoat-web     | SSE forwarding event: library-change {}
scrapegoat-web     | Job b37c78dc-2b3e-4f37-b0e1-e4a5af50621c enqueued successfully
scrapegoat-web     | 📦 Import job enqueued: b37c78dc-2b3e-4f37-b0e1-e4a5af50621c for Test-Archive4000Files@1.0.0
scrapegoat-web     | Received remote event: JOB_STATUS_CHANGE
scrapegoat-web     | Event emitted: JOB_STATUS_CHANGE
scrapegoat-web     | SSE forwarding event: job-status-change {"id":"b37c78dc-2b3e-4f37-b0e1-e4a5af50621c","library":"Test-Archive4000Files","version":"1.0.0","status":"running","error":null,"createdAt":"2026-06-08T04:04:02.242Z","startedAt":null,"finishedAt":null,"sourceUrl":"file:///import/Test-Archive4000Files/1.0.0/"}
scrapegoat-web     | Received remote event: LIBRARY_CHANGE
scrapegoat-web     | Event emitted: LIBRARY_CHANGE
scrapegoat-web     | SSE forwarding event: library-change {}
scrapegoat-web     | Received remote event: LIBRARY_CHANGE
scrapegoat-web     | Event emitted: LIBRARY_CHANGE
scrapegoat-web     | SSE forwarding event: library-change {}
scrapegoat-worker  | 📝 Job enqueued: b37c78dc-2b3e-4f37-b0e1-e4a5af50621c for Test-Archive4000Files@1.0.0
scrapegoat-worker  | Stored scraper options for Test-Archive4000Files@1.0.0: file:///import/Test-Archive4000Files/1.0.0/
scrapegoat-worker  | Event emitted: JOB_STATUS_CHANGE
scrapegoat-worker  | Event emitted: LIBRARY_CHANGE
scrapegoat-worker  | Job b37c78dc-2b3e-4f37-b0e1-e4a5af50621c status changed to: queued
scrapegoat-worker  | Event emitted: JOB_STATUS_CHANGE
scrapegoat-worker  | Event emitted: LIBRARY_CHANGE
scrapegoat-worker  | Job b37c78dc-2b3e-4f37-b0e1-e4a5af50621c status changed to: running
scrapegoat-worker  | [b37c78dc-2b3e-4f37-b0e1-e4a5af50621c] Worker starting job for Test-Archive4000Files@1.0.0
scrapegoat-worker  | 🗑️ Removing all documents from Test-Archive4000Files@1.0.0 store
scrapegoat-worker  | 🗑️ Deleted 0 documents
scrapegoat-worker  | Event emitted: LIBRARY_CHANGE
scrapegoat-worker  | 💾 Cleared store for Test-Archive4000Files@1.0.0 before scraping.
scrapegoat-worker  | Using strategy "LocalImportStrategy" for URL: file:///import/Test-Archive4000Files/1.0.0/
scrapegoat-worker  | Found 8 entries in import directory: /data/staging/upl_39dce82b-8bc6-4456-b1e1-f08c19b84332
scrapegoat-worker  | Found 146 entries in import directory: /data/staging/upl_39dce82b-8bc6-4456-b1e1-f08c19b84332/Rogue Trader - Battlefleet Koronus
scrapegoat-worker  | Found 401 entries in import directory: /data/staging/upl_39dce82b-8bc6-4456-b1e1-f08c19b84332/Rogue Trader - Core Rulebook (updated with 1.4 errata)
scrapegoat-worker  | Found 146 entries in import directory: /data/staging/upl_39dce82b-8bc6-4456-b1e1-f08c19b84332/Rogue Trader - Edge of the Abyss
scrapegoat-worker  | Found 34 entries in import directory: /data/staging/upl_39dce82b-8bc6-4456-b1e1-f08c19b84332/Rogue Trader - Game Master's Kit
scrapegoat-worker  | Found 113 entries in import directory: /data/staging/upl_39dce82b-8bc6-4456-b1e1-f08c19b84332/Rogue Trader - Hostile Acquisitions
scrapegoat-worker  | Found 0 entries in import directory: /data/staging/upl_39dce82b-8bc6-4456-b1e1-f08c19b84332/__extract_1780891344341
scrapegoat-worker  | Found 13 entries in import directory: /data/staging/upl_39dce82b-8bc6-4456-b1e1-f08c19b84332/Rogue Trader - Epoch-Koronus
scrapegoat-worker  | Found 146 entries in import directory: /data/staging/upl_39dce82b-8bc6-4456-b1e1-f08c19b84332/Rogue Trader - Faith and Coin
scrapegoat-worker  | ⚠️  [b37c78dc-2b3e-4f37-b0e1-e4a5af50621c] Worker encountered error: ScraperError: Local import file not found: /data/staging/upl_39dce82b-8bc6-4456-b1e1-f08c19b84332/Rogue Trader - Battlefleet Koronus - Page 0001.md. The file may not have been extracted from the archive.
scrapegoat-server  | Received remote event: JOB_STATUS_CHANGE
scrapegoat-server  | Event emitted: JOB_STATUS_CHANGE
scrapegoat-server  | Received remote event: LIBRARY_CHANGE
scrapegoat-server  | Event emitted: LIBRARY_CHANGE
scrapegoat-worker  | Event emitted: JOB_STATUS_CHANGE
scrapegoat-worker  | Event emitted: LIBRARY_CHANGE
scrapegoat-worker  | Job b37c78dc-2b3e-4f37-b0e1-e4a5af50621c status changed to: failed
scrapegoat-worker  | ❌ Job failed: b37c78dc-2b3e-4f37-b0e1-e4a5af50621c: ScraperError: Local import file not found: /data/staging/upl_39dce82b-8bc6-4456-b1e1-f08c19b84332/Rogue Trader - Battlefleet Koronus - Page 0001.md. The file may not have been extracted from the archive.
scrapegoat-worker  | 🧹 Cleaned up staging directory: /data/staging/upl_39dce82b-8bc6-4456-b1e1-f08c19b84332
scrapegoat-web     | Received remote event: JOB_STATUS_CHANGE
scrapegoat-web     | Event emitted: JOB_STATUS_CHANGE
scrapegoat-web     | SSE forwarding event: job-status-change {"id":"b37c78dc-2b3e-4f37-b0e1-e4a5af50621c","library":"Test-Archive4000Files","version":"1.0.0","status":"failed","error":null,"createdAt":"2026-06-08T04:04:02.242Z","startedAt":"2026-06-08T04:04:02.258Z","finishedAt":null,"sourceUrl":"file:///import/Test-Archive4000Files/1.0.0/"}
scrapegoat-web     | Received remote event: LIBRARY_CHANGE
scrapegoat-web     | Event emitted: LIBRARY_CHANGE
scrapegoat-web     | SSE forwarding event: library-change {}
```

---

## What should happen

- if Submitted item/archive/document exceeds Limit (count/size/etc), WebUI Show error, do not add item(s) to WebUI File list
- If WebUI File list is empty, do not enable "Accept & Submit", and check File list before submitting job.  Do not ever submit empty job.
- Backend, ALWAYS FINAL CHECK before finishing Job that Library; `is NOT EMPTY`  `IF EMPTY` -> API Job Status = Failed, Deletes created library for current job.


