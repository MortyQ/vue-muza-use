<!-- Syntax-highlighted JSON with horizontal scroll (no text wrap). -->
<script setup lang="ts">
import { computed } from "vue";

const props = defineProps<{ value: unknown }>();

const highlighted = computed(() => {
    try {
        const json = JSON.stringify(props.value, null, 2);
        return json.replace(
            /("(\\u[a-zA-Z0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d*)?(?:[eE][+\-]?\d+)?)/g,
            (match) => {
                if (/^"/.test(match)) {
                    if (/:$/.test(match)) return `<span class="json-key">${match}</span>`;
                    return `<span class="json-string">${match}</span>`;
                }
                if (/true|false|null/.test(match)) return `<span class="json-bool">${match}</span>`;
                return `<span class="json-number">${match}</span>`;
            },
        );
    } catch {
        return String(props.value);
    }
});
</script>

<template>
    <pre class="json-root" v-html="highlighted" />
</template>

<style scoped>
.json-root {
    font-family: "SF Mono", "Fira Code", Consolas, monospace;
    font-size: 12px;
    line-height: 1.7;
    white-space: pre;
    overflow-x: auto;
    color: var(--dt-foreground);
    margin: 0;
}
.json-root :deep(.json-key)    { color: oklch(72% 0.17 260); }
.json-root :deep(.json-string) { color: oklch(72% 0.17 145); }
.json-root :deep(.json-number) { color: oklch(74% 0.18 55); }
.json-root :deep(.json-bool)   { color: oklch(72% 0.18 25); }
</style>
