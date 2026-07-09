<script setup lang="ts">
import { ref } from "vue";
import { Icon } from "@iconify/vue";

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
        class="copy-btn"
        :class="{ copied }"
        :aria-label="copied ? 'Copied' : 'Copy'"
        :title="copied ? 'Copied' : 'Copy'"
        @click="copy"
    >
        <Icon :icon="copied ? 'lucide:check' : 'lucide:copy'" width="12" height="12" />
    </button>
</template>

<style scoped>
.copy-btn {
    flex-shrink: 0;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 18px;
    height: 18px;
    padding: 0;
    border: none;
    border-radius: 4px;
    background: transparent;
    color: var(--dt-foreground-muted);
    cursor: pointer;
    transition: color 120ms ease-out, background 120ms ease-out, transform 120ms ease-out;
}
.copy-btn:hover {
    color: var(--dt-foreground);
    background: var(--dt-surface-raised);
}
.copy-btn:active {
    transform: scale(0.97);
}
.copy-btn.copied,
.copy-btn.copied:hover {
    color: var(--dt-success);
}
</style>
