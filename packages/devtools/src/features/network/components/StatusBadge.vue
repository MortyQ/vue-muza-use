<script setup lang="ts">
import Badge from "../../../shared/components/Badge.vue";
import type { RequestStatus } from "../../../shared/types/index";
defineProps<{ status: RequestStatus; statusCode?: number | null }>();
const variant: Record<RequestStatus, string> = {
    success: "success", error: "error", pending: "pending", aborted: "aborted",
};
</script>
<template>
    <Badge :label="statusCode ? String(statusCode) : status" :variant="variant[status] as never" />
</template>
