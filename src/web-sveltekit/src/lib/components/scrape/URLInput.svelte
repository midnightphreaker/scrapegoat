<script lang="ts">
	import { cn } from "$lib/utils.js";
	import Input from "$lib/components/ui/input/input.svelte";
	import Button from "$lib/components/ui/button/button.svelte";
	import { X } from "@lucide/svelte";

	interface Props {
		value?: string;
		error?: string;
		canRemove?: boolean;
		onremove?: () => void;
		oninput?: (value: string) => void;
	}

	let {
		value = $bindable(""),
		error = "",
		canRemove = false,
		onremove,
		oninput,
	}: Props = $props();

	function handleInput(e: Event) {
		const target = e.target as HTMLInputElement;
		value = target.value;
		oninput?.(value);
	}
</script>

<div class="flex gap-2 items-start">
	<div class="flex-1">
		<Input
			type="url"
			placeholder="Enter documentation URL"
			{value}
			oninput={handleInput}
			class={cn(error && "border-destructive")}
		/>
		{#if error}
			<p class="text-sm text-destructive mt-1">{error}</p>
		{/if}
	</div>
	{#if canRemove}
		<Button
			type="button"
			variant="ghost"
			size="icon"
			onclick={() => onremove?.()}
			aria-label="Remove URL"
		>
			<X class="size-4" />
		</Button>
	{/if}
</div>
