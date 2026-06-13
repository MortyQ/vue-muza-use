<script setup lang="ts">
import { computed } from "vue";
import { NavigationSidebar } from "@ametie/ui";
import { sidebar } from "../routes/sidebar";

const contentMargin = computed(() => ({
    "lg:ml-64": !sidebar.isCollapsed.value,
    "lg:ml-20": sidebar.isCollapsed.value,
}));
</script>

<template>
    <div class="flex min-h-screen bg-background overflow-x-hidden">
        <NavigationSidebar :sidebar="sidebar" />

        <div
            :class="contentMargin"
            class="flex-1 flex flex-col transition-all duration-300 overflow-x-hidden"
        >
            <main class="flex-1 p-8 overflow-y-auto">
                <RouterView />
            </main>
        </div>
    </div>
</template>
