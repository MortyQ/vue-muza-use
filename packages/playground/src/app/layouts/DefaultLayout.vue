<script setup lang="ts">
import { NavigationSidebar } from "@ametie/ui";
import { sidebar } from "../routes/sidebar";
</script>

<template>
    <div class="layout">
        <NavigationSidebar :sidebar="sidebar" />
        <main class="layout__content">
            <RouterView />
        </main>
    </div>
</template>

<style scoped>
.layout { display: flex; min-height: 100vh; }
.layout__content { flex: 1; overflow-y: auto; padding: 32px; }
</style>
