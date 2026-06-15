<!-- Root devtools app — renders the correct panel wrapper based on persisted mode. -->
<script setup lang="ts">
import { useFloatingPanel } from "../features/panel/composables/useFloatingPanel";
import FloatingPanel from "../features/panel/components/FloatingPanel.vue";
import SidePanel from "../features/panel/components/SidePanel.vue";

const { panelMode } = useFloatingPanel();
</script>

<template>
    <FloatingPanel v-if="panelMode === 'bottom'" />
    <SidePanel v-else />
</template>
