```
OLD Issue 1. The `Scrape Job Failed` Red error message appears, even when a job successfully starts or completes, it should only appear if theres an error or 0 pages/0 snippets are the result of a scrape
```

Update 1. Now NO Jobs can be started, even entering a basic single url and clicking Queue Job, only shows "Request Failed.  Please try again". (in a red box where the old The `Scrape Job Failed` Red error message appeared), and nothing shows in the Scrapegoat logs on the server, not even a failure.

---

```
OLD Issue 2. The items in the Job Queue that are currently being processed, will get corrupted when a new job is added, their Pages count, Total Pages, Percent done, and the actual progress bar itself will report incorrect information, including the progress bar stretching off the page!
```

Update 2. I could not check this as no Jobs can be queued at all now.

---

```
OLD Issue 3. Currently everytime the Libary list is loaded or accessed, it seems like it is retrieved completely and the data is loaded over and over again, this should be a smart cache for the Webui and in turn the scrapegoat tools like 'list_libraries', it should not batter the Postgres database EVERYTIME!
```

Update 3. It seems the Library caching is working, refreshing the page loads the libraries instantly!


---

```
OLD Issue 4. The Scrapegoat WebUI, needs to have a + button beside the URL text entry box, that creates another blank URL text entry box below the last one, and can keep being clicked until there are 10 total URL text entry boxes visible.  When the Job is submitted, All the the URL text entry boxes, are checked for VALID url's and all Valid URL's are attached to the Scrape Job, so multiple URLs can be scaped into the 1 Library!
```

Update 4. The + button is now there like requested, and I can click it to add new URL Entries, and I can click the red cross on the right side of the added URL Entries to remove them, and also like i asked, only 9 (10 total) can be added, nothing happens after the nineth click which is great.


---
```
OLD Issue 5. The Existing Scraped WebUI Libaries list, that is below the main Scape input entry, Each of those entries, require another button on each, similarr to the red delete button with the garbage can icon, this is a blue button with a recycle icon, that when clicked, asks for conformation, and if yes, resubmits the original job (URL, Pages, depth, scope, patterns etc) for scraping, and when done, appears as another version in the library but has a text label beside the version, with a little yellow rectangle background, with text inside it "(Rescraped - DDMMYY)".
```

Update 5. There is no new blue button, and now the Red Trash Icon button, (You used to click the red trash icon, and it would expand to say Confirm? when you clicked it again it would delete the library), it now loads as the "Confirm?" button, but now it is all white, and clicking it does nothing.

---

```
OLD Issue 6. Scraped libraries in the webui, if the title OR version is double clicked, it becomes a text inputbox with the current title/version pre-populated, and if it is changed, then the title or version of the library is updated in the backend postgres database and that specific library item is refresh to show the new title or version.
```

Udpate 6. clicking or double clicking the library name only activates the navigation to the library search page (https://docs.fenrirsden.org/libraries/lib_name) thats all.  But, you can double click the version number and it changes to a populated entry box with the version number in it, but changing the number and pressing enter does nothing, and refresh the page with the new number, simply reverts to the old version, and again, none of this has any affect on the backend.

