<script setup lang="ts">
const emit = defineEmits<{ resize: [delta: { dw: number; dh: number }] }>();

function onMouseDown(e: MouseEvent): void {
    let prevX = e.clientX;
    let prevY = e.clientY;

    const onMove = (mv: MouseEvent) => {
        emit("resize", { dw: mv.clientX - prevX, dh: mv.clientY - prevY });
        prevX = mv.clientX;
        prevY = mv.clientY;
    };
    const onUp = () => {
        window.removeEventListener("mousemove", onMove);
        window.removeEventListener("mouseup", onUp);
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
}
</script>

<template>
    <div
        class="absolute bottom-0 right-0 w-4 h-4 cursor-se-resize opacity-40 hover:opacity-100"
        @mousedown.prevent="onMouseDown"
    >⠿</div>
</template>
