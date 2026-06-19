import { ref, computed, onMounted, onScopeDispose } from "vue";
import type { Ref } from "vue";
import type { PanelMode, PanelGeometry } from "../../../shared/types/index";
import { loadPanelGeometry, savePanelGeometry } from "../../../shared/storage/devtoolsStorage";

const MIN_WIDTH_SIDE = 280;
const MIN_HEIGHT_SIDE = 200;
const MIN_WIDTH_BOTTOM = 400;
const MIN_HEIGHT_BOTTOM = 200;

function defaultSideGeometry(): PanelGeometry {
    return {
        x: window.innerWidth - 390,
        y: 10,
        width: 380,
        height: window.innerHeight - 20,
    };
}

function defaultBottomGeometry(): PanelGeometry {
    return {
        x: 12,
        y: window.innerHeight - 368,
        width: window.innerWidth - 24,
        height: 360,
    };
}

// Static fallbacks used before window dimensions are available
const STATIC_SIDE: PanelGeometry = { x: 0, y: 10, width: 380, height: 600 };
const STATIC_BOTTOM: PanelGeometry = { x: 12, y: 300, width: 800, height: 360 };

// Module-level singletons — persist across component remounts
const _sideGeometry = ref<PanelGeometry>({ ...STATIC_SIDE });
const _bottomGeometry = ref<PanelGeometry>({ ...STATIC_BOTTOM });
const _isGeometryReady = ref(false);
let _geometryLoaded = false;
let _activeCleanup: (() => void) | null = null;

/**
 * Return type for usePanelGeometry.
 */
export interface UsePanelGeometryReturn {
    /** Reactive geometry for the currently active panel mode. Read-only. */
    geometry: Ref<PanelGeometry>;
    /** False until IndexedDB load completes. Panel should be hidden until true. */
    isGeometryReady: Ref<boolean>;
    /** Attach to logo pill mousedown — drags the panel. */
    startDrag: (e: MouseEvent) => void;
    /** Attach to top resize handle mousedown — resizes height upward. */
    startResizeTop: (e: MouseEvent) => void;
    /** Attach to bottom resize handle mousedown — resizes height downward. */
    startResizeBottom: (e: MouseEvent) => void;
    /** Attach to left resize handle mousedown — resizes width leftward. */
    startResizeLeft: (e: MouseEvent) => void;
    /** Attach to right resize handle mousedown — resizes width rightward. */
    startResizeRight: (e: MouseEvent) => void;
    /** Resets the active mode's geometry to default and saves to IndexedDB. */
    resetGeometry: () => void;
}

/**
 * Composable that owns geometry (x, y, width, height) for both panel modes.
 * Loads from IndexedDB on first mount, persists on every drag/resize mouseup.
 *
 * @example
 * ```ts
 * const { geometry, isGeometryReady, startDrag, startResizeLeft } = usePanelGeometry(panelMode);
 * ```
 */
export function usePanelGeometry(panelMode: Ref<PanelMode>): UsePanelGeometryReturn {
    const geometry = computed(() =>
        panelMode.value === "side" ? _sideGeometry.value : _bottomGeometry.value
    ) as Ref<PanelGeometry>;

    onMounted(async () => {
        if (_geometryLoaded) return;
        const [savedSide, savedBottom] = await Promise.all([
            loadPanelGeometry("side"),
            loadPanelGeometry("bottom"),
        ]);
        _sideGeometry.value = savedSide ?? defaultSideGeometry();
        _bottomGeometry.value = savedBottom ?? defaultBottomGeometry();
        _geometryLoaded = true;
        _isGeometryReady.value = true;
    });

    function geomRef(): Ref<PanelGeometry> {
        return panelMode.value === "side" ? _sideGeometry : _bottomGeometry;
    }

    function minW(): number { return panelMode.value === "side" ? MIN_WIDTH_SIDE : MIN_WIDTH_BOTTOM; }
    function minH(): number { return panelMode.value === "side" ? MIN_HEIGHT_SIDE : MIN_HEIGHT_BOTTOM; }

    function makeCleanup(rafRef: { id: number }, onMove: (e: MouseEvent) => void, onUp: () => void): () => void {
        return () => {
            cancelAnimationFrame(rafRef.id);
            window.removeEventListener("mousemove", onMove);
            window.removeEventListener("mouseup", onUp);
        };
    }

    function startDrag(e: MouseEvent): void {
        const startX = e.clientX;
        const startY = e.clientY;
        const ref = geomRef();
        const startGeo = { ...ref.value };
        const raf = { id: 0 };

        const onMove = (ev: MouseEvent): void => {
            cancelAnimationFrame(raf.id);
            raf.id = requestAnimationFrame(() => {
                const dx = ev.clientX - startX;
                const dy = ev.clientY - startY;
                ref.value = {
                    ...ref.value,
                    x: Math.max(0, Math.min(window.innerWidth - startGeo.width, startGeo.x + dx)),
                    y: Math.max(0, Math.min(window.innerHeight - startGeo.height, startGeo.y + dy)),
                };
            });
        };

        const onUp = (): void => {
            cancelAnimationFrame(raf.id);
            _activeCleanup = null;
            savePanelGeometry(panelMode.value, ref.value);
            window.removeEventListener("mousemove", onMove);
            window.removeEventListener("mouseup", onUp);
        };

        _activeCleanup = makeCleanup(raf, onMove, onUp);
        window.addEventListener("mousemove", onMove);
        window.addEventListener("mouseup", onUp);
    }

    function startResizeTop(e: MouseEvent): void {
        const startY = e.clientY;
        const ref = geomRef();
        const bottomEdge = ref.value.y + ref.value.height;
        const startH = ref.value.height;
        const mh = minH();
        const raf = { id: 0 };

        const onMove = (ev: MouseEvent): void => {
            cancelAnimationFrame(raf.id);
            raf.id = requestAnimationFrame(() => {
                const dy = ev.clientY - startY;
                const newH = Math.max(mh, Math.min(bottomEdge, startH - dy));
                ref.value = { ...ref.value, y: bottomEdge - newH, height: newH };
            });
        };

        const onUp = (): void => {
            cancelAnimationFrame(raf.id);
            _activeCleanup = null;
            savePanelGeometry(panelMode.value, ref.value);
            window.removeEventListener("mousemove", onMove);
            window.removeEventListener("mouseup", onUp);
        };

        _activeCleanup = makeCleanup(raf, onMove, onUp);
        window.addEventListener("mousemove", onMove);
        window.addEventListener("mouseup", onUp);
    }

    function startResizeBottom(e: MouseEvent): void {
        const startY = e.clientY;
        const ref = geomRef();
        const startH = ref.value.height;
        const startGeoY = ref.value.y;
        const mh = minH();
        const raf = { id: 0 };

        const onMove = (ev: MouseEvent): void => {
            cancelAnimationFrame(raf.id);
            raf.id = requestAnimationFrame(() => {
                const dy = ev.clientY - startY;
                const maxH = window.innerHeight - startGeoY;
                ref.value = { ...ref.value, height: Math.max(mh, Math.min(maxH, startH + dy)) };
            });
        };

        const onUp = (): void => {
            cancelAnimationFrame(raf.id);
            _activeCleanup = null;
            savePanelGeometry(panelMode.value, ref.value);
            window.removeEventListener("mousemove", onMove);
            window.removeEventListener("mouseup", onUp);
        };

        _activeCleanup = makeCleanup(raf, onMove, onUp);
        window.addEventListener("mousemove", onMove);
        window.addEventListener("mouseup", onUp);
    }

    function startResizeLeft(e: MouseEvent): void {
        const startX = e.clientX;
        const ref = geomRef();
        const rightEdge = ref.value.x + ref.value.width;
        const startW = ref.value.width;
        const mw = minW();
        const raf = { id: 0 };

        const onMove = (ev: MouseEvent): void => {
            cancelAnimationFrame(raf.id);
            raf.id = requestAnimationFrame(() => {
                const dx = ev.clientX - startX;
                const newW = Math.max(mw, Math.min(rightEdge, startW - dx));
                ref.value = { ...ref.value, x: rightEdge - newW, width: newW };
            });
        };

        const onUp = (): void => {
            cancelAnimationFrame(raf.id);
            _activeCleanup = null;
            savePanelGeometry(panelMode.value, ref.value);
            window.removeEventListener("mousemove", onMove);
            window.removeEventListener("mouseup", onUp);
        };

        _activeCleanup = makeCleanup(raf, onMove, onUp);
        window.addEventListener("mousemove", onMove);
        window.addEventListener("mouseup", onUp);
    }

    function startResizeRight(e: MouseEvent): void {
        const startX = e.clientX;
        const ref = geomRef();
        const startW = ref.value.width;
        const startGeoX = ref.value.x;
        const mw = minW();
        const raf = { id: 0 };

        const onMove = (ev: MouseEvent): void => {
            cancelAnimationFrame(raf.id);
            raf.id = requestAnimationFrame(() => {
                const dx = ev.clientX - startX;
                const maxW = window.innerWidth - startGeoX;
                ref.value = { ...ref.value, width: Math.max(mw, Math.min(maxW, startW + dx)) };
            });
        };

        const onUp = (): void => {
            cancelAnimationFrame(raf.id);
            _activeCleanup = null;
            savePanelGeometry(panelMode.value, ref.value);
            window.removeEventListener("mousemove", onMove);
            window.removeEventListener("mouseup", onUp);
        };

        _activeCleanup = makeCleanup(raf, onMove, onUp);
        window.addEventListener("mousemove", onMove);
        window.addEventListener("mouseup", onUp);
    }

    function resetGeometry(): void {
        if (panelMode.value === "side") {
            _sideGeometry.value = defaultSideGeometry();
            savePanelGeometry("side", _sideGeometry.value);
        } else {
            _bottomGeometry.value = defaultBottomGeometry();
            savePanelGeometry("bottom", _bottomGeometry.value);
        }
    }

    onScopeDispose(() => { _activeCleanup?.(); });

    return {
        geometry,
        isGeometryReady: _isGeometryReady,
        startDrag,
        startResizeTop,
        startResizeBottom,
        startResizeLeft,
        startResizeRight,
        resetGeometry,
    };
}

/** @internal — resets module-level singletons for test isolation */
export function _resetGeometryForTesting(): void {
    _sideGeometry.value = { ...STATIC_SIDE };
    _bottomGeometry.value = { ...STATIC_BOTTOM };
    _isGeometryReady.value = false;
    _geometryLoaded = false;
    _activeCleanup = null;
}

/** @internal — sets geometry for a specific mode in tests */
export function _setGeometryForTesting(mode: PanelMode, geo: PanelGeometry): void {
    if (mode === "side") _sideGeometry.value = { ...geo };
    else _bottomGeometry.value = { ...geo };
}
