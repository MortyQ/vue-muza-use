import { ref, onMounted, onScopeDispose } from "vue";
import type { Ref } from "vue";
import { loadPanelHeight, savePanelHeight } from "../../../shared/storage/devtoolsStorage";

/**
 * Return type for the useFloatingPanel composable.
 */
export interface UseFloatingPanelReturn {
    /** Panel height in pixels. */
    height: Ref<number>;
    /** Whether the panel is currently visible. */
    isOpen: Ref<boolean>;
    /** Begin top-edge drag to resize panel height. Attach to the resize handle's mousedown. */
    startResizeHeight: (e: MouseEvent) => void;
    /** Toggle panel visibility. */
    toggle: () => void;
    /** Hide the panel. */
    close: () => void;
}

const DEFAULT_HEIGHT = 360;
const MIN_HEIGHT = 200;
const MAX_HEIGHT_RATIO = 0.8;

/**
 * Composable for the bottom-drawer devtools panel.
 * Manages open/close state and height-only resize, persisted to IndexedDB.
 *
 * @example
 * ```ts
 * const { height, isOpen, startResizeHeight, toggle, close } = useFloatingPanel();
 * ```
 */
export function useFloatingPanel(): UseFloatingPanelReturn {
    const height = ref(DEFAULT_HEIGHT);
    const isOpen = ref(false);

    onMounted(async () => {
        const saved = await loadPanelHeight();
        if (saved !== undefined) height.value = saved;
    });

    function toggle(): void { isOpen.value = !isOpen.value; }
    function close(): void { isOpen.value = false; }

    let resizing = false;
    let cleanup: (() => void) | null = null;

    function startResizeHeight(e: MouseEvent): void {
        const startY = e.clientY;
        const startH = height.value;
        resizing = true;

        function onMove(ev: MouseEvent): void {
            if (!resizing) return;
            const maxH = Math.floor(window.innerHeight * MAX_HEIGHT_RATIO);
            height.value = Math.max(MIN_HEIGHT, Math.min(startH + (startY - ev.clientY), maxH));
        }

        function onUp(): void {
            resizing = false;
            cleanup = null;
            savePanelHeight(height.value);
            window.removeEventListener("mousemove", onMove);
            window.removeEventListener("mouseup", onUp);
        }

        cleanup = () => {
            window.removeEventListener("mousemove", onMove);
            window.removeEventListener("mouseup", onUp);
        };

        window.addEventListener("mousemove", onMove);
        window.addEventListener("mouseup", onUp);
        e.preventDefault();
    }

    onScopeDispose(() => { cleanup?.(); });

    return { height, isOpen, startResizeHeight, toggle, close };
}
