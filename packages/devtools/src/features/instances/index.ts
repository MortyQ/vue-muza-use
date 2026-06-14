import type { DevtoolsTab } from "../../shared/types/index";
import InstancesTab from "./components/InstancesTab.vue";

export const instancesTab: DevtoolsTab = {
    id: "instances",
    label: "Instances",
    icon: "📋",
    order: 0,
    component: InstancesTab,
};
