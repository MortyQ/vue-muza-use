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
        class="vmd:text-xs vmd:text-neutral-400 vmd:hover:text-white vmd:px-1"
        @click="copy"
    >{{ copied ? "✓" : "copy" }}</button>
</template>
