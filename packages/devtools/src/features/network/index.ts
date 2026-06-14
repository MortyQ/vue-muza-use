import type { DevtoolsTab } from "../../shared/types/index";
import NetworkTab from "./components/NetworkTab.vue";

export const networkTab: DevtoolsTab = {
    id: "network",
    label: "Network",
    icon: "lucide:network",
    order: 1,
    component: NetworkTab,
};
