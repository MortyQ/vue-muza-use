import { ref, onMounted, onScopeDispose } from "vue";
import type { Ref } from "vue";
import type { PanelMode } from "../../../shared/types/index";
import { loadPanelMode, savePanelMode } from "../../../shared/storage/devtoolsStorage";
import { usePanelGeometry } from "./usePanelGeometry";
import type { UsePanelGeometryReturn } from "./usePanelGeometry";

/**
 * Return type for the useFloatingPanel composable.
 */
export interface UseFloatingPanelReturn extends UsePanelGeometryReturn {
    /** Whether the panel is currently visible. */
    isOpen: Ref<boolean>;
    /** Current panel mode. */
    panelMode: Ref<PanelMode>;
    /** Switch panel mode and persist to IndexedDB. */
    switchMode: (mode: PanelMode) => void;
    /** Toggle panel visibility. */
    toggle: () => void;
    /** Hide the panel. */
    close: () => void;
}

// Module-level singletons so state persists across mode switches
const _isOpen = ref(false);
const _panelMode = ref<PanelMode>("side");
let _panelModeLoaded = false;

/**
 * Composable for devtools panel state.
 * Manages open/close, mode (bottom/side), and delegates all geometry to usePanelGeometry.
 *
 * @example
 * ```ts
 * const { geometry, isGeometryReady, isOpen, panelMode, startDrag, startResizeLeft,
 *         startResizeTop, startResizeBottom, startResizeRight, switchMode, toggle, close,
 *         resetGeometry } = useFloatingPanel();
 * ```
 */
export function useFloatingPanel(): UseFloatingPanelReturn {
    const isOpen = _isOpen;
    const panelMode = _panelMode;

    onMounted(async () => {
        if (_panelModeLoaded) return;
        const savedMode = await loadPanelMode();
        _panelMode.value = savedMode;
        _panelModeLoaded = true;
    });

    function toggle(): void { isOpen.value = !isOpen.value; }
    function close(): void { isOpen.value = false; }

    function switchMode(mode: PanelMode): void {
        _panelMode.value = mode;
        savePanelMode(mode);
    }

    const geometry = usePanelGeometry(panelMode);

    onScopeDispose(() => {});

    return {
        isOpen,
        panelMode,
        toggle,
        close,
        switchMode,
        ...geometry,
    };
}

/** @internal — resets module-level singletons for test isolation */
export function _resetPanelModeForTesting(): void {
    _isOpen.value = false;
    _panelMode.value = "side";
    _panelModeLoaded = false;
}
