/**
 * Alpine.js localUpload data component for the upload panel.
 *
 * This script is loaded client-side and provides the Alpine.data('localUpload')
 * component used by LocalUploadPanel.tsx.
 *
 * Manages: session creation, file upload via fetch, import tree operations,
 * rename/delete/move, commit, and cancel.
 */

/* eslint-disable */
// @ts-nocheck

document.addEventListener("alpine:init", () => {
  Alpine.data("localUpload", (library, version) => ({
    library,
    version: version || "",
    sessionId: null,
    uploading: false,
    uploadProgress: 0,
    uploadErrors: [],
    stagedFiles: [],
    tree: null,
    flatNodes: [],
    stats: null,
    showTree: true,
    committing: false,
    selectedNode: null,

    async init() {
      // Session creation is deferred until files or folders are added.
      // See createSession().
    },

    async createSession() {
      if (this.sessionId) return;
      if (
        !this.library ||
        this.library.trim() === "" ||
        !this.version ||
        this.version.trim() === ""
      ) {
        this.uploadErrors = [
          {
            path: "session",
            error: "Library Name and Version are required before upload",
          },
        ];
        return;
      }
      try {
        const resp = await fetch("/web/upload/start", {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: `library=${encodeURIComponent(this.library.trim())}&version=${encodeURIComponent(this.version.trim())}`,
        });
        if (!resp.ok) {
          const err = await resp.json().catch(() => ({ error: "Failed to create session" }));
          this.uploadErrors = [{ path: "session", error: err.error || "Unknown error" }];
          return;
        }
        const data = await resp.json();
        this.sessionId = data.sessionId;
        this.uploadErrors = [];
      } catch (e) {
        this.uploadErrors = [{ path: "session", error: e.message || "Network error" }];
      }
    },

    async closePanel() {
      if (this.sessionId) {
        try {
          await this.cancelImport();
        } catch (_e) {
          // Still navigate even if cancel fails
        }
      }
      if (typeof htmx !== "undefined") {
        const versionContainer = document.getElementById("add-version-form-container");
        if (versionContainer && versionContainer.contains(this.$el)) {
          htmx.ajax("GET", `/web/libraries/${encodeURIComponent(this.library)}/upload-version-button`, { target: "#add-version-form-container", swap: "innerHTML" });
        } else {
          htmx.ajax("GET", "/web/jobs/new-button", { target: "#addJobForm", swap: "innerHTML" });
        }
        const modalContainer = document.getElementById("modal-container");
        if (modalContainer) modalContainer.innerHTML = "";
      }
    },

    async handleFiles(eventOrFileList) {
      const fileList = eventOrFileList?.target?.files ?? eventOrFileList;
      if (fileList.length === 0) return;
      if (!this.sessionId) {
        await this.createSession();
        if (!this.sessionId) return;
      }
      this.uploading = true;
      this.uploadProgress = 0;
      this.uploadErrors = [];

      const formData = new FormData();
      for (const file of fileList) {
        formData.append("files", file);
      }

      try {
        const xhr = new XMLHttpRequest();
        xhr.open("POST", `/web/upload/files?sessionId=${encodeURIComponent(this.sessionId)}`);

        xhr.upload.onprogress = (e) => {
          if (e.lengthComputable) {
            this.uploadProgress = Math.round((e.loaded / e.total) * 100);
          }
        };

        const result = await new Promise((resolve, reject) => {
          xhr.onload = () => {
            if (xhr.status >= 200 && xhr.status < 300) {
              resolve(JSON.parse(xhr.responseText));
            } else {
              reject(new Error(xhr.responseText));
            }
          };
          xhr.onerror = () => reject(new Error("Upload failed"));
          xhr.send(formData);
        });

        if (result.stagedFiles) {
          this.stagedFiles = [...this.stagedFiles, ...result.stagedFiles];
        }
        if (result.errors && result.errors.length > 0) {
          this.uploadErrors = result.errors;
        }

        await this.refreshTree();
      } catch (e) {
        this.uploadErrors = [{ path: "upload", error: e.message || "Upload failed" }];
      } finally {
        this.uploading = false;
        this.uploadProgress = 0;
        if (eventOrFileList?.target) {
          eventOrFileList.target.value = "";
        }
      }
    },

    async handleFolderSelect(event) {
      const files = event.target.files;
      if (!files || files.length === 0) return;
      if (!this.sessionId) {
        await this.createSession();
        if (!this.sessionId) return;
      }

      this.uploading = true;
      this.uploadProgress = 0;
      this.uploadErrors = [];

      const formData = new FormData();
      for (const file of files) {
        formData.append("files", file, file.webkitRelativePath || file.name);
      }

      try {
        const xhr = new XMLHttpRequest();
        xhr.open("POST", `/web/upload/files?sessionId=${encodeURIComponent(this.sessionId)}`);

        xhr.upload.onprogress = (e) => {
          if (e.lengthComputable) {
            this.uploadProgress = Math.round((e.loaded / e.total) * 100);
          }
        };

        const result = await new Promise((resolve, reject) => {
          xhr.onload = () => {
            if (xhr.status >= 200 && xhr.status < 300) {
              resolve(JSON.parse(xhr.responseText));
            } else {
              reject(new Error(xhr.responseText));
            }
          };
          xhr.onerror = () => reject(new Error("Upload failed"));
          xhr.send(formData);
        });

        if (result.stagedFiles) {
          this.stagedFiles = [...this.stagedFiles, ...result.stagedFiles];
        }
        if (result.errors && result.errors.length > 0) {
          this.uploadErrors = result.errors;
        }

        await this.refreshTree();
      } catch (e) {
        this.uploadErrors = [{ path: "upload", error: e.message || "Upload failed" }];
      } finally {
        this.uploading = false;
        this.uploadProgress = 0;
        // Reset the input so the same folder can be re-selected
        event.target.value = "";
      }
    },

    async createVirtualFolder() {
      if (!this.sessionId) {
        await this.createSession();
        if (!this.sessionId) return;
      }
      const name = window.prompt("Enter folder name:");
      if (!name || name.trim() === "") return;
      try {
        const resp = await fetch("/web/upload/tree/virtual-folder", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            sessionId: this.sessionId,
            folderPath: name.trim(),
          }),
        });
        if (resp.ok) {
          await this.refreshTree();
        } else {
          const err = await resp.json().catch(() => ({ error: "Failed to create folder" }));
          this.uploadErrors = [{ path: "virtual-folder", error: err.error || "Unknown error" }];
        }
      } catch (e) {
        this.uploadErrors = [{ path: "virtual-folder", error: e.message || "Failed to create folder" }];
      }
    },

    async refreshTree() {
      if (!this.sessionId) return;
      try {
        const resp = await fetch(`/web/upload/tree?sessionId=${encodeURIComponent(this.sessionId)}`);
        if (resp.ok) {
          const data = await resp.json();
          this.tree = data.tree;
          this.stats = data.stats;
          this.flatNodes = this.flattenTree(data.tree, 0);
        }
      } catch (e) {
        console.error("Failed to refresh tree:", e);
      }
    },

    flattenTree(nodes, depth) {
      if (!nodes || !Array.isArray(nodes)) return [];
      const result = [];
      for (const node of nodes) {
        result.push({ ...node, depth });
        if (node.children && node.children.length > 0) {
          result.push(...this.flattenTree(node.children, depth + 1));
        }
      }
      return result;
    },

    selectNode(node) {
      this.selectedNode = node;
    },

    get sourcePathPreview() {
      if (!this.selectedNode) return "";
      return `${this.library} ${this.version} > ${this.selectedNode.relativePath || this.selectedNode.path || this.selectedNode.name}`;
    },

    async startRename(node) {
      const newName = prompt("Enter new name:", node.name);
      if (!newName || newName === node.name) return;
      try {
        const resp = await fetch("/web/upload/tree/rename", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            sessionId: this.sessionId,
            fileId: node.id,
            newName,
          }),
        });
        if (resp.ok) await this.refreshTree();
      } catch (e) {
        console.error("Rename failed:", e);
      }
    },

    async removeNode(node) {
      if (!confirm(`Remove "${node.name}"?`)) return;
      try {
        const resp = await fetch("/web/upload/tree/delete", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            sessionId: this.sessionId,
            fileId: node.id,
          }),
        });
        if (resp.ok) await this.refreshTree();
      } catch (e) {
        console.error("Remove failed:", e);
      }
    },

    async moveNode(node) {
      if (!this.sessionId) return;
      const targetPath = prompt("Move to folder:", "/");
      if (targetPath === null) return;
      try {
        const resp = await fetch("/web/upload/tree/move", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            sessionId: this.sessionId,
            fileId: node.id,
            newRelativePath: targetPath
              ? `${targetPath.replace(/\/$/, "")}/${node.name}`
              : node.name,
          }),
        });
        if (resp.ok) await this.refreshTree();
      } catch (e) {
        console.error("Move failed:", e);
      }
    },

    async commitImport() {
      if (!this.sessionId) return;

      if (!window.confirm('This will ingest the selected files into a documentation library.\n\nThe file and folder layout currently shown in this window will be used as the source path layout for retrieval results.\n\nUploaded source files are temporary and will be removed after ingestion completes.\n\nContinue?')) return;

      this.committing = true;
      try {
        const resp = await fetch("/web/upload/commit", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sessionId: this.sessionId }),
        });
        if (resp.ok) {
          const result = await resp.json();
          const stats = result.stats || {};

          // Trigger toast notification
          document.dispatchEvent(
            new CustomEvent("toast", {
              detail: {
                message: `Successfully imported ${result.library}@${result.version}`,
                type: "success",
              },
            }),
          );

          // Report prompts
          if (stats.failedFiles > 0) {
            if (window.confirm("Some files failed to upload. Download report?")) {
              this.downloadFile(`/web/upload/report/failed?sessionId=${encodeURIComponent(this.sessionId)}`, "Scrapegoat-FailedToUpload.txt");
            }
          }

          if (stats.renamedFiles > 0) {
            if (window.confirm("Some files were renamed. Download report?")) {
              this.downloadFile(`/web/upload/report/renamed?sessionId=${encodeURIComponent(this.sessionId)}`, "Scrapegoat-RenamedFiles.txt");
            }
          }

          // Close the upload panel or redirect
          this.sessionId = null;
          this.stagedFiles = [];
          this.tree = null;
          this.flatNodes = [];
          this.stats = null;
          this.showTree = true;
          this.selectedNode = null;
          await this.closePanel();
        } else {
          const err = await resp.json().catch(() => ({ error: "Commit failed" }));
          this.uploadErrors = [{ path: "commit", error: err.error }];
        }
      } catch (e) {
        this.uploadErrors = [{ path: "commit", error: e.message || "Commit failed" }];
      } finally {
        this.committing = false;
      }
    },

    downloadFile(url, filename) {
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    },

    async cancelImport() {
      if (!this.sessionId) return;
      try {
        await fetch("/web/upload/cancel", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sessionId: this.sessionId }),
        });
      } catch (e) {
        console.error("Cancel failed:", e);
      }
      this.sessionId = null;
      this.stagedFiles = [];
      this.tree = null;
      this.flatNodes = [];
      this.stats = null;
      this.showTree = true;
      this.uploadErrors = [];
      this.selectedNode = null;
    },

    formatSize(bytes) {
      if (!bytes) return "0 B";
      const units = ["B", "KB", "MB", "GB"];
      let i = 0;
      let size = bytes;
      while (size >= 1024 && i < units.length - 1) {
        size /= 1024;
        i++;
      }
      return `${size.toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
    },
  }));
});
