<script setup lang="ts">
defineProps<{
    onDragStart: (e: MouseEvent) => void;
    onClose: () => void;
    onToggle: () => void;
}>();
</script>

<template>
    <div
        class="vmd:flex vmd:items-center vmd:justify-between vmd:px-3 vmd:py-2 vmd:cursor-grab vmd:select-none vmd:bg-neutral-800 vmd:border-b vmd:border-neutral-700"
        @mousedown="onDragStart"
    >
        <span class="vmd:text-xs vmd:font-semibold vmd:text-neutral-300">● vue-muza devtools</span>
        <div class="vmd:flex vmd:gap-2">
            <button class="vmd:text-neutral-400 vmd:hover:text-white" @click.stop="onToggle">—</button>
            <button class="vmd:text-neutral-400 vmd:hover:text-white" @click.stop="onClose">✕</button>
        </div>
    </div>
</template>
