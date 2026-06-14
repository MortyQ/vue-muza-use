<script setup lang="ts">
import type { DevtoolsInstanceState } from "../../../shared/types/index";
import Badge from "../../../shared/components/Badge.vue";
defineProps<{ state: DevtoolsInstanceState }>();
</script>

<template>
    <div class="vmd:flex vmd:gap-2 vmd:items-center vmd:text-xs">
        <Badge v-if="state.loading" label="loading" variant="pending" />
        <Badge v-else-if="state.error" label="error" variant="error" />
        <Badge v-else label="idle" variant="neutral" />
        <span v-if="state.statusCode" class="vmd:text-neutral-400">{{ state.statusCode }}</span>
    </div>
</template>
