<script setup lang="ts">
import { ref } from "vue";

const props = defineProps<{ value: string }>();
const copied = ref(false);

async function copy(): Promise<void> {
    await navigator.clipboard.writeText(props.value);
    copied.value = true;
    setTimeout(() => { copied.value = false; }, 1500);
}
</script>

<template>
    <button
        class="text-xs text-neutral-400 hover:text-white px-1"
        @click="copy"
    >{{ copied ? "✓" : "copy" }}</button>
</template>
