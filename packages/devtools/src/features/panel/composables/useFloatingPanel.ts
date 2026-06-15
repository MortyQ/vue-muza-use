import { ref, onMounted, onScopeDispose } from "vue";
import type { Ref } from "vue";
import type { PanelMode } from "../../../shared/types/index";
import {
    loadPanelHeight, savePanelHeight,
    loadPanelMode, savePanelMode,
    loadPanelSideWidth, savePanelSideWidth,
} from "../../../shared/storage/devtoolsStorage";

/**
 * Return type for the useFloatingPanel composable.
 */
export interface UseFloatingPanelReturn {
    /** Panel height in pixels (bottom mode). */
    height: Ref<number>;
    /** Whether the panel is currently visible. */
    isOpen: Ref<boolean>;
    /** Current panel mode. */
    panelMode: Ref<PanelMode>;
    /** Side panel width in pixels. */
    sideWidth: Ref<number>;
    /** Begin top-edge drag to resize panel height. Attach to the resize handle's mousedown. */
    startResizeHeight: (e: MouseEvent) => void;
    /** Begin left-edge drag to resize side panel width. Attach to the resize handle's mousedown. */
    startResizeSideWidth: (e: MouseEvent) => void;
    /** Switch panel mode and persist to IndexedDB. */
    switchMode: (mode: PanelMode) => void;
    /** Toggle panel visibility. */
    toggle: () => void;
    /** Hide the panel. */
    close: () => void;
}

const DEFAULT_HEIGHT = 360;
const MIN_HEIGHT = 200;
const MAX_HEIGHT_RATIO = 0.8;

const DEFAULT_SIDE_WIDTH = 380;
const MIN_SIDE_WIDTH = 280;
const MAX_SIDE_WIDTH_RATIO = 0.6;

// Module-level singleton so panelMode is shared across all callers (DevtoolsApp + wrapper)
const _panelMode = ref<PanelMode>("bottom");
let _panelModeLoaded = false;

/**
 * Composable for devtools panel state.
 * Manages open/close, mode (bottom/side), height and side-width resize — all persisted to IndexedDB.
 *
 * @example
 * ```ts
 * const { height, sideWidth, isOpen, panelMode, startResizeHeight, startResizeSideWidth, switchMode, toggle, close } = useFloatingPanel();
 * ```
 */
export function useFloatingPanel(): UseFloatingPanelReturn {
    const height = ref(DEFAULT_HEIGHT);
    const isOpen = ref(false);
    const panelMode = _panelMode;
    const sideWidth = ref(DEFAULT_SIDE_WIDTH);

    onMounted(async () => {
        const [savedHeight, savedMode, savedSideWidth] = await Promise.all([
            loadPanelHeight(),
            _panelModeLoaded ? Promise.resolve(_panelMode.value) : loadPanelMode(),
            loadPanelSideWidth(),
        ]);
        if (savedHeight !== undefined) height.value = savedHeight;
        if (!_panelModeLoaded) {
            _panelMode.value = savedMode;
            _panelModeLoaded = true;
        }
        if (savedSideWidth !== undefined) sideWidth.value = savedSideWidth;
    });

    function toggle(): void { isOpen.value = !isOpen.value; }
    function close(): void { isOpen.value = false; }

    function switchMode(mode: PanelMode): void {
        _panelMode.value = mode;
        savePanelMode(mode);
    }

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

    function startResizeSideWidth(e: MouseEvent): void {
        const startX = e.clientX;
        const startW = sideWidth.value;
        resizing = true;

        function onMove(ev: MouseEvent): void {
            if (!resizing) return;
            const maxW = Math.floor(window.innerWidth * MAX_SIDE_WIDTH_RATIO);
            // Panel is on the right — dragging left increases width
            sideWidth.value = Math.max(MIN_SIDE_WIDTH, Math.min(startW + (startX - ev.clientX), maxW));
        }

        function onUp(): void {
            resizing = false;
            cleanup = null;
            savePanelSideWidth(sideWidth.value);
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

    return { height, isOpen, panelMode, sideWidth, startResizeHeight, startResizeSideWidth, switchMode, toggle, close };
}
