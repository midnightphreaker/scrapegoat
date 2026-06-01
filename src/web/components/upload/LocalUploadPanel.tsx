/**
 * LocalUploadPanel — upload local files/archives for documentation import.
 *
 * Uses HTMX for file upload and Alpine.js for local state management.
 * Flowbite-styled to match the existing ScrapeGoat WebUI.
 */

import type { PropsWithChildren } from "@kitajs/html";

interface LocalUploadPanelProps extends PropsWithChildren {
  library: string;
  version?: string;
}

const LocalUploadPanel = ({ library, version }: LocalUploadPanelProps) => {
  return (
    <div
      x-data={`localUpload('${library}', '${version || "latest"}')`}
      class="bg-white border border-gray-200 rounded-lg shadow-sm dark:bg-gray-800 dark:border-gray-700"
    >
      {/* Header */}
      <div class="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
        <h3 class="text-lg font-semibold text-gray-900 dark:text-white">
          Add Local Documentation Source
        </h3>
        <button
          type="button"
          class="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
          hx-get="/web/jobs/source-selection"
          hx-target="#modal-container"
          hx-swap="innerHTML"
          title="Close"
        >
          <svg class="w-5 h-5" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <path stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Library / Version fields */}
      <div class="px-6 pt-5 grid grid-cols-2 gap-4">
        <div>
          <label
            for="upload-library"
            class="block mb-2 text-sm font-medium text-gray-900 dark:text-white"
          >
            Library Name *
          </label>
          <input
            id="upload-library"
            type="text"
            class="bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-full p-2.5 dark:bg-gray-700 dark:border-gray-600 dark:placeholder-gray-400 dark:text-white dark:focus:ring-blue-500 dark:focus:border-blue-500"
            x-model="library"
            required
          />
        </div>
        <div>
          <label
            for="upload-version"
            class="block mb-2 text-sm font-medium text-gray-900 dark:text-white"
          >
            Version
          </label>
          <input
            id="upload-version"
            type="text"
            class="bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-full p-2.5 dark:bg-gray-700 dark:border-gray-600 dark:placeholder-gray-400 dark:text-white dark:focus:ring-blue-500 dark:focus:border-blue-500"
            x-model="version"
          />
        </div>
      </div>

      {/* Upload area */}
      <div class="p-6">
        {/* Drop zone */}
        <div
          x-ref="dropzone"
          x-on:dragover="$event.preventDefault(); dragover = true"
          x-on:dragleave="$event.preventDefault(); dragover = false"
          x-on:drop="$event.preventDefault(); handleDrop($event)"
          x-bind:class="dragover ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20' : 'border-gray-300 dark:border-gray-600'"
          class="flex flex-col items-center justify-center w-full px-6 py-8 border-2 border-dashed rounded-lg cursor-pointer transition-colors"
          x-on:click="$refs.fileInput.click()"
        >
          <svg
            class="w-10 h-10 mb-3 text-gray-400"
            aria-hidden="true"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 20 16"
          >
            <path
              stroke="currentColor"
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M13 13h3a3 3 0 0 0 0-6h-.025A5.56 5.56 0 0 0 16 6.5 5.5 5.5 0 0 0 5.207 5.021C5.137 5.017 5.071 5 5 5a4 4 0 0 0 0 8h2.167M10 15V6m0 0L8 8m2-2 2 2"
            />
          </svg>
          <p class="mb-2 text-sm text-gray-500 dark:text-gray-400">
            <span class="font-semibold">Click to upload</span> or drag and drop
          </p>
          <p class="text-xs text-gray-500 dark:text-gray-400">
            Markdown files, ZIP/TAR archives, or folders
          </p>
          <input
            x-ref="fileInput"
            type="file"
            class="hidden"
            multiple
            accept=".md,.markdown,.txt,.zip,.tar,.tar.gz,.tgz,.tar.bz2"
            x-on:change="handleFiles($event.target.files)"
          />
        </div>

        {/* Add Folder / Add Virtual Folder buttons */}
        <div class="mt-3 flex gap-2">
          <button
            type="button"
            class="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 dark:bg-gray-800 dark:text-gray-400 dark:border-gray-600 dark:hover:text-white dark:hover:bg-gray-700"
            x-on:click="$refs.folderInput.click()"
          >
            Add Folder
          </button>
          <input
            x-ref="folderInput"
            type="file"
            class="hidden"
            {...{ webkitdirectory: true }}
            x-on:change="handleFolderSelect($event)"
          />
          <button
            type="button"
            class="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 dark:bg-gray-800 dark:text-gray-400 dark:border-gray-600 dark:hover:text-white dark:hover:bg-gray-700"
            x-on:click="createVirtualFolder()"
          >
            Add Virtual Folder
          </button>
        </div>

        {/* Upload progress */}
        <template x-if="uploading">
          <div class="mt-4">
            <div class="flex items-center justify-between mb-1">
              <span class="text-sm font-medium text-blue-700 dark:text-blue-400">
                Uploading files...
              </span>
              <span
                class="text-sm font-medium text-blue-700 dark:text-blue-400"
                x-text="uploadProgress + '%'"
              />
            </div>
            <div class="w-full bg-gray-200 rounded-full h-2.5 dark:bg-gray-700">
              <div
                class="bg-blue-600 h-2.5 rounded-full transition-all duration-300"
                x-bind:style="'width: ' + uploadProgress + '%'"
              />
            </div>
          </div>
        </template>

        {/* Upload errors */}
        <template x-if="uploadErrors.length > 0">
          <div class="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg dark:bg-red-900/20 dark:border-red-800">
            <h4 class="text-sm font-medium text-red-800 dark:text-red-400 mb-2">
              Some files failed to upload:
            </h4>
            <ul class="text-sm text-red-700 dark:text-red-300 list-disc list-inside">
              <template x-for="err in uploadErrors" x-bind:key="err.path">
                <li>
                  <span x-text="err.path" /> — <span x-text="err.error" />
                </li>
              </template>
            </ul>
          </div>
        </template>

        {/* Staged files count */}
        <template x-if="stagedFiles.length > 0">
          <div class="mt-4 flex items-center justify-between">
            <span class="text-sm text-gray-600 dark:text-gray-400">
              <span
                class="font-semibold text-gray-900 dark:text-white"
                x-text="stagedFiles.length"
              />{" "}
              file(s) staged
            </span>
            <button
              type="button"
              class="text-sm text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 font-medium"
              x-on:click="showTree = !showTree"
              x-text="showTree ? 'Hide import tree' : 'Review import tree'"
            />
          </div>
        </template>

        {/* Import Tree */}
        <template x-if="showTree && tree">
          <div class="mt-4">
            <div class="flex items-center justify-between mb-3">
              <h4 class="text-sm font-semibold text-gray-900 dark:text-white">
                Import Tree
              </h4>
              <div class="flex gap-2">
                <button
                  type="button"
                  class="px-3 py-1 text-xs font-medium text-green-700 bg-green-100 border border-green-200 rounded-lg hover:bg-green-200 dark:bg-green-900/30 dark:text-green-400 dark:border-green-800 dark:hover:bg-green-900/50"
                  x-on:click="refreshTree()"
                >
                  Refresh
                </button>
              </div>
            </div>
            <div
              id="import-tree"
              class="border border-gray-200 rounded-lg dark:border-gray-700 overflow-auto max-h-80"
            >
              <template x-for="node in flatNodes" x-bind:key="node.id">
                <div
                  class="flex items-center gap-2 px-3 py-2 border-b border-gray-100 last:border-0 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/50"
                  x-bind:style="'padding-left: ' + (node.depth * 20 + 12) + 'px'"
                  x-on:click="selectNode(node)"
                >
                  {/* File/folder icon */}
                  <svg
                    x-show="node.type === 'folder'"
                    class="w-4 h-4 text-yellow-500 shrink-0"
                    aria-hidden="true"
                    xmlns="http://www.w3.org/2000/svg"
                    fill="currentColor"
                    viewBox="0 0 18 20"
                  >
                    <path d="M18 14H2a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h5l2 2h9a2 2 0 0 1 2 2v2h-2v-1H8.5l-2-2H2v8h16v1Zm0 2H2v2h16v-2Z" />
                  </svg>
                  <svg
                    x-show="node.type === 'file'"
                    class="w-4 h-4 text-blue-500 shrink-0"
                    aria-hidden="true"
                    xmlns="http://www.w3.org/2000/svg"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path d="M13 4H7a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2ZM7 14V6h6v8H7ZM5 2h10v2H5V2Z" />
                  </svg>

                  {/* Name */}
                  <span
                    class="text-sm text-gray-900 dark:text-white flex-1 truncate"
                    x-text="node.name"
                  />

                  {/* Size */}
                  <span
                    x-show="node.size"
                    class="text-xs text-gray-500 dark:text-gray-400 shrink-0"
                    x-text="formatSize(node.size)"
                  />

                  {/* Actions */}
                  <div x-show="node.type === 'file'" class="flex gap-1 shrink-0">
                    <button
                      type="button"
                      class="p-1 text-gray-400 hover:text-blue-600 dark:hover:text-blue-400"
                      title="Rename"
                      x-on:click="$event.stopPropagation(); startRename(node)"
                    >
                      <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                      </svg>
                    </button>
                    <button
                      type="button"
                      class="p-1 text-gray-400 hover:text-green-600 dark:hover:text-green-400"
                      title="Move"
                      x-on:click="$event.stopPropagation(); moveNode(node)"
                    >
                      <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                      </svg>
                    </button>
                    <button
                      type="button"
                      class="p-1 text-gray-400 hover:text-red-600 dark:hover:text-red-400"
                      title="Remove"
                      x-on:click="$event.stopPropagation(); removeNode(node)"
                    >
                      <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                </div>
              </template>
            </div>

            {/* Source path preview */}
            <div
              x-show="selectedNode"
              class="mt-2 px-3 py-2 text-xs text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-700/50 rounded-lg font-mono truncate"
              x-text="sourcePathPreview"
            >
            </div>
          </div>
        </template>

        {/* Stats */}
        <template x-if="stats">
          <div class="mt-4 grid grid-cols-3 gap-3">
            <div class="text-center p-3 bg-gray-50 rounded-lg dark:bg-gray-700">
              <div
                class="text-lg font-semibold text-gray-900 dark:text-white"
                x-text="stats.fileCount"
              />
              <div class="text-xs text-gray-500 dark:text-gray-400">Files</div>
            </div>
            <div class="text-center p-3 bg-gray-50 rounded-lg dark:bg-gray-700">
              <div
                class="text-lg font-semibold text-gray-900 dark:text-white"
                x-text="formatSize(stats.totalSize)"
              />
              <div class="text-xs text-gray-500 dark:text-gray-400">Total Size</div>
            </div>
            <div class="text-center p-3 bg-gray-50 rounded-lg dark:bg-gray-700">
              <div
                class="text-lg font-semibold text-gray-900 dark:text-white"
                x-text="stats.folderCount || 0"
              />
              <div class="text-xs text-gray-500 dark:text-gray-400">Folders</div>
            </div>
          </div>
        </template>

        {/* Action buttons */}
        <div class="mt-6 flex items-center gap-3">
          <button
            type="button"
            class="px-5 py-2.5 text-sm font-medium text-white bg-blue-700 rounded-lg hover:bg-blue-800 focus:ring-4 focus:ring-blue-300 dark:bg-blue-600 dark:hover:bg-blue-700 dark:focus:ring-blue-800 disabled:opacity-50 disabled:cursor-not-allowed"
            x-bind:disabled="stagedFiles.length === 0 || committing"
            x-on:click="commitImport()"
            x-text="committing ? 'Importing...' : 'Accept & Submit'"
          >
            Accept &amp; Submit
          </button>
          <button
            type="button"
            class="px-5 py-2.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 dark:bg-gray-800 dark:text-gray-400 dark:border-gray-600 dark:hover:text-white dark:hover:bg-gray-700"
            x-on:click="cancelImport()"
            x-show="stagedFiles.length > 0"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
};

export default LocalUploadPanel;
