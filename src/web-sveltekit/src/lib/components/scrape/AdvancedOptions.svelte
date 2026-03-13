<script lang="ts">
	import Input from "$lib/components/ui/input/input.svelte";
	import Button from "$lib/components/ui/button/button.svelte";
	import { ChevronDown, ChevronUp } from "@lucide/svelte";

	interface AdvancedOptionsData {
		maxPages: number;
		maxDepth: number;
		scope: "subpages" | "hostname" | "domain";
		includePatterns: string[];
		excludePatterns: string[];
		headers: Record<string, string>;
		followRedirects: boolean;
		ignoreErrors: boolean;
	}

	interface Props {
		value?: AdvancedOptionsData;
		onchange?: (value: AdvancedOptionsData) => void;
	}

	let {
		value = $bindable<AdvancedOptionsData>({
			maxPages: 1000,
			maxDepth: 3,
			scope: "subpages",
			includePatterns: [],
			excludePatterns: [],
			headers: {},
			followRedirects: true,
			ignoreErrors: false,
		}),
		onchange,
	}: Props = $props();

	let expanded = $state(false);
	let includePatternsText = $state("");
	let excludePatternsText = $state("");
	let headersText = $state("");

	function update<K extends keyof AdvancedOptionsData>(key: K, newValue: AdvancedOptionsData[K]) {
		value = { ...value, [key]: newValue };
		onchange?.(value);
	}

	function handleIncludePatternsInput(text: string) {
		includePatternsText = text;
		const patterns = text.split("\n").map((s) => s.trim()).filter(Boolean);
		update("includePatterns", patterns);
	}

	function handleExcludePatternsInput(text: string) {
		excludePatternsText = text;
		const patterns = text.split("\n").map((s) => s.trim()).filter(Boolean);
		update("excludePatterns", patterns);
	}

	function handleHeadersInput(text: string) {
		headersText = text;
		try {
			const parsed = text.trim() ? JSON.parse(text) : {};
			update("headers", parsed);
		} catch {
			// Invalid JSON, keep previous value
		}
	}
</script>

<div class="border rounded-lg">
	<Button
		type="button"
		variant="ghost"
		class="w-full flex items-center justify-between px-4 py-2"
		onclick={() => (expanded = !expanded)}
	>
		<span class="font-medium">Advanced Options</span>
		{#if expanded}
			<ChevronUp class="size-4" />
		{:else}
			<ChevronDown class="size-4" />
		{/if}
	</Button>

	{#if expanded}
		<div class="p-4 space-y-4 border-t">
			<div class="grid grid-cols-2 gap-4">
				<div>
					<label class="block text-sm font-medium mb-1">Max Pages</label>
					<Input
						type="number"
						value={String(value.maxPages)}
						oninput={(e) => update("maxPages", parseInt((e.target as HTMLInputElement).value) || 1000)}
					/>
				</div>
				<div>
					<label class="block text-sm font-medium mb-1">Max Depth</label>
					<Input
						type="number"
						value={String(value.maxDepth)}
						oninput={(e) => update("maxDepth", parseInt((e.target as HTMLInputElement).value) || 3)}
					/>
				</div>
			</div>

			<div>
				<label class="block text-sm font-medium mb-1">Scope</label>
				<select
					class="flex h-9 w-full rounded-md border bg-background px-3 py-1 text-sm shadow-xs"
					value={value.scope}
					onchange={(e) => update("scope", (e.target as HTMLSelectElement).value as AdvancedOptionsData["scope"])}
				>
					<option value="subpages">Subpages Only</option>
					<option value="hostname">Same Hostname</option>
					<option value="domain">Same Domain</option>
				</select>
			</div>

			<div>
				<label class="block text-sm font-medium mb-1">Include Patterns (one per line)</label>
				<textarea
					class="flex min-h-[80px] w-full rounded-md border bg-background px-3 py-1 text-sm shadow-xs"
					placeholder="/docs/*&#10;/api/*"
					value={includePatternsText}
					oninput={(e) => handleIncludePatternsInput((e.target as HTMLTextAreaElement).value)}
				></textarea>
			</div>

			<div>
				<label class="block text-sm font-medium mb-1">Exclude Patterns (one per line)</label>
				<textarea
					class="flex min-h-[80px] w-full rounded-md border bg-background px-3 py-1 text-sm shadow-xs"
					placeholder="/blog/*&#10;/admin/*"
					value={excludePatternsText}
					oninput={(e) => handleExcludePatternsInput((e.target as HTMLTextAreaElement).value)}
				></textarea>
			</div>

			<div>
				<label class="block text-sm font-medium mb-1">Custom Headers (JSON)</label>
				<textarea
					class="flex min-h-[80px] w-full rounded-md border bg-background px-3 py-1 text-sm font-mono shadow-xs"
					placeholder="Authorization: Bearer token"
					value={headersText}
					oninput={(e) => handleHeadersInput((e.target as HTMLTextAreaElement).value)}
				></textarea>
			</div>

			<div class="flex gap-4">
				<label class="flex items-center gap-2">
					<input
						type="checkbox"
						checked={value.followRedirects}
						onchange={(e) => update("followRedirects", (e.target as HTMLInputElement).checked)}
						class="size-4"
					/>
					<span class="text-sm">Follow Redirects</span>
				</label>

				<label class="flex items-center gap-2">
					<input
						type="checkbox"
						checked={value.ignoreErrors}
						onchange={(e) => update("ignoreErrors", (e.target as HTMLInputElement).checked)}
						class="size-4"
					/>
					<span class="text-sm">Ignore Errors</span>
				</label>
			</div>
		</div>
	{/if}
</div>
