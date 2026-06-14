<script setup lang="ts">
defineProps<{
    onDragStart: (e: MouseEvent) => void;
    onClose: () => void;
    onToggle: () => void;
}>();
</script>

<template>
    <div
        class="flex items-center justify-between px-3 py-2 cursor-grab select-none bg-surface-raised border-b border-border"
        @mousedown="onDragStart"
    >
        <span class="text-xs font-semibold text-foreground-secondary">● vue-muza devtools</span>
        <div class="flex gap-2">
            <button class="text-foreground-muted hover:text-foreground" @click.stop="onToggle">—</button>
            <button class="text-foreground-muted hover:text-foreground" @click.stop="onClose">✕</button>
        </div>
    </div>
</template>
