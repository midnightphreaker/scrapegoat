# Error Handling still not working as expected in WebUI for Import Jobs

# Example 1 

### Document exceeds Maximum file size

Upload 15MB Document to WebUIno erroradds File to Job listclick Accept & SubmitWebUI Immediately finishesReports Successfully indexed JobLibrary Added, Pages: 0 / Chunks: 0 / Last Update: N/A

### What should have happened

Upload 15MB Document to WebUIWebUi shows error about Document exceeding Maximum File Size15MB Document NOT added File to Job listBecause Import Tree empty, "Accept & Submit" button still disabledCannot Submit Empty Job.

## Details

### WebUI Job Queue
```
Job Queue
Clear Completed Jobs
test-15MB_doc 1

Last Indexed: 6/9/2026, 1:37:38 PM
Successfully indexed
```

### Library Added;
```
test-15mb_doc
file:///import/test-15MB_doc/1/
1
Pages: 0
Chunks: 0
Last Update: N/A
```


### Backend Log;
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


# Example 2

### Archive File Count exceeds Maximum Archive File Count Limit

Upload Archive with More than (Max Archive File Count) Files to WebUIShows Error (below)Shows Warning (below)adds all Files in Archive to to Import TreeShows 999 Files (Max Archive File Count) and 4.2 MB Total Size (Total Archive File Size) 0 Folders in Import Tree Summaryclick Accept & SubmitWebUI Immediately finishesReports Indexing Failed Job (error below: WebUI Job Queue Error)Library Not Added, but didnt stop the job from proceeding first!

### What should have happened

Upload Archive with More than (Max Archive File Count) Files to WebUIShows Error - Archive exceeds Maximum file count!No files added File to Job listBecause Import Tree empty, "Accept & Submit" button still disabledCannot Submit Empty Job.

**NOTE: It could also be combining two issues, Max Archive File Count, and Max File Count for Virtual Folder.**

## Details

### Import Tree File List before Accept and Submit
```
999 Files
4.2 MB Total Size
0 Folders
```

### WebUI Error
```
Some files failed to upload:
Rogue Trader - Source Books (Markdown).zip — Maximum file count reached (999) for session upl_53833384-5443-4cd1-ba51-39e6e8dbde8e
```


### WebUI Warning
```
1 file(s) failed to upload:
Rogue Trader - Source Books (Markdown).zip — Maximum file count reached (999) for session upl_53833384-5443-4cd1-ba51-39e6e8dbde8e
```


### WebUI Virtual Upload Folder
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

### WebUI Log downloaded
```
# ScrapeGoat — Files that failed to upload
# Session: upl_53833384-5443-4cd1-ba51-39e6e8dbde8e
# Library: test-Over999FileZip v1
# Generated: 2026-06-09T13:50:21.039Z

Rogue Trader - Source Books (Markdown).zip	Maximum file count reached (999) for session upl_53833384-5443-4cd1-ba51-39e6e8dbde8e
```

### WebUI Job Queue Error
```
test-Over999FileZip 1

Last Indexed: 6/9/2026, 1:50:20 PM

Error:
Local import file not found: /data/staging/upl_53833384-5443-4cd1-ba51-39e6e8dbde8e/Rogue Trader - Battlefleet Koronus - Page 0001.md. The file may not have been extracted from the archive.

                                          Indexing failed
                                                    Error
```


### Backend Log
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
