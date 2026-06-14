import { ref, watch, onMounted, onScopeDispose } from "vue";
import type { Ref } from "vue";
import {
    loadPanelPosition,
    savePanelPosition,
    loadPanelSize,
    savePanelSize,
} from "../../../shared/storage/devtoolsStorage";

/**
 * Return type for the useFloatingPanel composable.
 */
export interface UseFloatingPanelReturn {
    /** Reactive panel position in viewport coordinates. */
    position: Ref<{ x: number; y: number }>;
    /** Reactive panel dimensions. */
    size: Ref<{ width: number; height: number }>;
    /** Whether the panel is currently visible. */
    isOpen: Ref<boolean>;
    /** Begin drag on mousedown — attaches mousemove/mouseup listeners to window. */
    onDragStart: (e: MouseEvent) => void;
    /** Toggle panel visibility. */
    toggle: () => void;
    /** Hide the panel. */
    close: () => void;
}

/**
 * Composable for a draggable, resizable floating panel.
 * Persists position and size to IndexedDB via devtoolsStorage.
 *
 * @example
 * ```ts
 * const { position, size, isOpen, onDragStart, toggle, close } = useFloatingPanel();
 * ```
 */
export function useFloatingPanel(): UseFloatingPanelReturn {
    const position = ref<{ x: number; y: number }>({ x: 100, y: 100 });
    const size = ref<{ width: number; height: number }>({ width: 800, height: 500 });
    const isOpen = ref(true);

    onMounted(async () => {
        const [savedPos, savedSize] = await Promise.all([loadPanelPosition(), loadPanelSize()]);
        if (savedPos) position.value = savedPos;
        if (savedSize) size.value = savedSize;
    });

    watch(position, (pos) => savePanelPosition(pos), { deep: true });
    watch(size, (s) => savePanelSize(s), { deep: true });

    let drag: { mouseX: number; mouseY: number; posX: number; posY: number } | null = null;

    function onDragMove(e: MouseEvent): void {
        if (!drag) return;
        position.value = {
            x: drag.posX + (e.clientX - drag.mouseX),
            y: drag.posY + (e.clientY - drag.mouseY),
        };
    }

    function onDragEnd(): void {
        drag = null;
        window.removeEventListener("mousemove", onDragMove);
        window.removeEventListener("mouseup", onDragEnd);
    }

    function onDragStart(e: MouseEvent): void {
        drag = { mouseX: e.clientX, mouseY: e.clientY, posX: position.value.x, posY: position.value.y };
        window.addEventListener("mousemove", onDragMove);
        window.addEventListener("mouseup", onDragEnd);
    }

    function toggle(): void { isOpen.value = !isOpen.value; }
    function close(): void { isOpen.value = false; }

    onScopeDispose(() => {
        window.removeEventListener("mousemove", onDragMove);
        window.removeEventListener("mouseup", onDragEnd);
    });

    return { position, size, isOpen, onDragStart, toggle, close };
}
