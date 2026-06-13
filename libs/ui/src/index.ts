import "./styles/tokens.css";

export { default as VButton } from "./components/base/VButton.vue";
export { default as VIcon } from "./components/base/VIcon.vue";
export { default as VTag, type TagVariant, type TagColor, type TagSize } from "./components/base/VTag.vue";
export { default as VThemeSwitcher, type ThemeOption } from "./components/base/VThemeSwitcher.vue";
export { default as VInput } from "./components/inputs/VInput.vue";
export { default as VDatepicker } from "./components/inputs/VDatepicker.vue";
export { default as VCheckbox, type CheckboxValue, type CheckboxModelValue } from "./components/inputs/VCheckbox.vue";
export { default as VSwitch } from "./components/inputs/VSwitch.vue";
export { default as VSelect } from "./components/inputs/VSelect.vue";
export { default as VSegmentedControl, type SegmentOption } from "./components/inputs/VSegmentedControl.vue";
export { default as VToggleGroup, type ToggleOption } from "./components/inputs/VToggleGroup.vue";
export { default as VTooltip } from "./components/overlay/VTooltip.vue";
export { default as VDrawer } from "./components/overlay/VDrawer.vue";
export { default as VModal } from "./components/overlay/VModal.vue";
export { default as VTab } from "./components/layout/VTab.vue";
export {
  default as VCard, type CardSize, type CardVariant, type CardRadius, type CardPadding,
} from "./components/layout/VCard.vue";
export { default as VAnimatedBackground } from "./components/layout/VAnimatedBackground.vue";
export { default as VFloating } from "./components/overlay/VFloating.vue";
export { default as VToaster } from "./components/feedback/VToaster.vue";
export { default as VLoader } from "./components/feedback/VLoader.vue";
export { default as VTable } from "./components/table/VTable.vue";
export type { Column, SortItem, PaginationConfig, ToolbarConfig, ExpandableRow } from "./components/table/types/index";
export type { TableProps } from "./components/table/types/props";

export { useToast } from "./composables/useToast";
export { useModal } from "./composables/useModal";

export type { FieldValidation } from "./types/validation";
export type { SelectOption } from "./types/select";

// ── Navigation Sidebar ──────────────────────────────────────────────────────
export {
  NavigationSidebar,
  createSidebar,
  useSidebarState,
  useNavigation,
  buildMenuTree,
} from "./components/navigation-sidebar";
export type {
  SidebarNavItem,
  SidebarOptions,
  SidebarInstance,
  SidebarRouteMeta,
  FlatMenuItem,
} from "./components/navigation-sidebar";

declare module "vue" {
  export interface GlobalComponents {
    NavigationSidebar: typeof import("./components/navigation-sidebar/NavigationSidebar.vue").default
    VButton: typeof import("./components/base/VButton.vue").default
    VIcon: typeof import("./components/base/VIcon.vue").default
    VTag: typeof import("./components/base/VTag.vue").default
    VThemeSwitcher: typeof import("./components/base/VThemeSwitcher.vue").default
    VInput: typeof import("./components/inputs/VInput.vue").default
    VDatepicker: typeof import("./components/inputs/VDatepicker.vue").default
    VCheckbox: typeof import("./components/inputs/VCheckbox.vue").default
    VSwitch: typeof import("./components/inputs/VSwitch.vue").default
    VSelect: typeof import("./components/inputs/VSelect.vue").default
    VSegmentedControl: typeof import("./components/inputs/VSegmentedControl.vue").default
    VToggleGroup: typeof import("./components/inputs/VToggleGroup.vue").default
    VTooltip: typeof import("./components/overlay/VTooltip.vue").default
    VDrawer: typeof import("./components/overlay/VDrawer.vue").default
    VModal: typeof import("./components/overlay/VModal.vue").default
    VTab: typeof import("./components/layout/VTab.vue").default
    VCard: typeof import("./components/layout/VCard.vue").default
    VAnimatedBackground: typeof import("./components/layout/VAnimatedBackground.vue").default
    VFloating: typeof import("./components/overlay/VFloating.vue").default
    VToaster: typeof import("./components/feedback/VToaster.vue").default
    VLoader: typeof import("./components/feedback/VLoader.vue").default
    VTable: typeof import("./components/table/VTable.vue").default
  }
}
