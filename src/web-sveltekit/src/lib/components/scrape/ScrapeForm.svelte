<script lang="ts">
	import { trpc } from "$lib/api/trpc";
	import type { EnqueueJobInput } from "$lib/api/types";
	import Card from "$lib/components/ui/card/card.svelte";
	import CardContent from "$lib/components/ui/card/card-content.svelte";
	import CardHeader from "$lib/components/ui/card/card-header.svelte";
	import CardTitle from "$lib/components/ui/card/card-title.svelte";
	import Input from "$lib/components/ui/input/input.svelte";
	import Button from "$lib/components/ui/button/button.svelte";
	import URLInput from "./URLInput.svelte";
	import AdvancedOptions from "./AdvancedOptions.svelte";
	import { jobsStore } from "$lib/stores/jobs.svelte";
	import { Plus } from "@lucide/svelte";

	const MAX_URLS = 10;

	interface URLInput {
		id: number;
		value: string;
		error: string;
	}

	let urls = $state<URLInput[]>([{ id: 1, value: "", error: "" }]);
	let library = $state("");
	let version = $state("");
	let advancedOptions = $state({
		maxPages: 1000,
		maxDepth: 3,
		scope: "subpages" as "subpages" | "hostname" | "domain",
		includePatterns: [] as string[],
		excludePatterns: [] as string[],
		headers: {} as Record<string, string>,
		followRedirects: true,
		ignoreErrors: false,
	});
	let submitting = $state(false);

	let canAddUrl = $derived(urls.length < MAX_URLS);

	function validateUrl(url: string): string {
		if (!url.trim()) return "URL is required";
		try {
			const parsed = new URL(url);
			if (!["http:", "https:"].includes(parsed.protocol)) {
				return "URL must be http or https";
			}
			return "";
		} catch {
			return "Invalid URL format";
		}
	}

	function addUrl() {
		if (!canAddUrl) return;
		urls = [...urls, { id: Date.now(), value: "", error: "" }];
	}

	function removeUrl(id: number) {
		urls = urls.filter((u) => u.id !== id);
	}

	function updateUrl(id: number, value: string) {
		urls = urls.map((u) => (u.id === id ? { ...u, value, error: "" } : u));
	}

	async function handleSubmit(e: Event) {
		e.preventDefault();

		// Validate all URLs
		let hasErrors = false;
		urls = urls.map((u) => {
			const error = validateUrl(u.value);
			if (error) hasErrors = true;
			return { ...u, error };
		});

		if (hasErrors) return;

		if (!library.trim()) {
			return;
		}

		submitting = true;

		try {
			for (const urlInput of urls) {
				if (urlInput.value.trim()) {
					const input: EnqueueJobInput = {
						library: library.trim(),
						version: version.trim() || null,
						options: {
							url: urlInput.value.trim(),
							library: library.trim(),
							version: version.trim() || "",
							maxPages: advancedOptions.maxPages,
							maxDepth: advancedOptions.maxDepth,
							scope: advancedOptions.scope,
							followRedirects: advancedOptions.followRedirects,
							ignoreErrors: advancedOptions.ignoreErrors,
							includePatterns: advancedOptions.includePatterns.length > 0 ? advancedOptions.includePatterns : undefined,
							excludePatterns: advancedOptions.excludePatterns.length > 0 ? advancedOptions.excludePatterns : undefined,
							headers: Object.keys(advancedOptions.headers).length > 0 ? advancedOptions.headers : undefined,
						},
					};
				await trpc.enqueueJob.mutate(input);
			}
			jobsStore.fetch().catch(console.error);
			}

			// Reset form on success
			urls = [{ id: Date.now(), value: "", error: "" }];
			library = "";
			version = "";
		} finally {
			submitting = false;
		}
	}
</script>

<Card>
	<CardHeader>
		<CardTitle>Scrape Documentation</CardTitle>
	</CardHeader>
	<CardContent>
		<form onsubmit={handleSubmit} class="space-y-4">
			<div>
				<label class="block text-sm font-medium mb-2">Documentation URLs</label>
				<div class="space-y-2">
					{#each urls as urlInput (urlInput.id)}
						<URLInput
							value={urlInput.value}
							error={urlInput.error}
							canRemove={urls.length > 1}
							onremove={() => removeUrl(urlInput.id)}
							oninput={(value) => updateUrl(urlInput.id, value)}
						/>
					{/each}
				</div>
				<Button type="button" variant="outline" size="sm" class="mt-2" onclick={addUrl} disabled={!canAddUrl}>
					<Plus class="w-4 h-4 mr-1" />
					Add URL
				</Button>
			</div>

			<div class="grid grid-cols-2 gap-4">
				<div>
					<label for="library" class="block text-sm font-medium mb-1">Library Name *</label>
					<Input
						id="library"
						type="text"
						placeholder="react"
						bind:value={library}
						required
					/>
				</div>
				<div>
					<label for="version" class="block text-sm font-medium mb-1">Version (optional)</label>
					<Input
						id="version"
						type="text"
						placeholder="18.0.0"
						bind:value={version}
					/>
				</div>
			</div>

			<AdvancedOptions bind:value={advancedOptions} />

			<Button type="submit" class="w-full" disabled={submitting}>
				{submitting ? "Queueing..." : "Queue Scrape Job"}
			</Button>
		</form>
	</CardContent>
</Card>
