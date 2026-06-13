<script lang="ts" setup>
import { Toaster } from "vue-sonner";
</script>

<template>
  <Toaster
    :duration="4000"
    :toast-options="{
      unstyled: true,
      classes: {
        toast: 'toast-custom',
        title: 'toast-title',
        description: 'toast-description',
        actionButton: 'toast-action',
        cancelButton: 'toast-cancel',
        closeButton: 'toast-close',
        error: 'toast-error',
        success: 'toast-success',
        warning: 'toast-warning',
        info: 'toast-info',
      },
    }"
    close-button
    position="top-right"
  />
</template>

<style scoped>
@import "../../styles/components/feedback/vtoaster.scss";
</style>
