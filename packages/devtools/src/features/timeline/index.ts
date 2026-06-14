import type { DevtoolsTab } from "../../shared/types/index";
import TimelineTab from "./components/TimelineTab.vue";

export const timelineTab: DevtoolsTab = {
    id: "timeline",
    label: "Timeline",
    icon: "⏱",
    order: 2,
    component: TimelineTab,
};
