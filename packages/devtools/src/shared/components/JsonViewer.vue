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
                    if (/:$/.test(match)) return `<span class="vmd:text-purple-400">${match}</span>`;
                    return `<span class="vmd:text-green-400">${match}</span>`;
                }
                if (/true|false|null/.test(match)) return `<span class="vmd:text-yellow-400">${match}</span>`;
                return `<span class="vmd:text-blue-400">${match}</span>`;
            },
        );
    } catch {
        return String(props.value);
    }
});
</script>

<template>
    <pre
        class="vmd:text-xs vmd:leading-relaxed vmd:whitespace-pre-wrap vmd:break-all"
        v-html="highlighted"
    />
</template>
