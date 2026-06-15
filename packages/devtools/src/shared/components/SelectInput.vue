<!-- Wrapper around native <select> with fixed width and devtools token styling. -->
<script setup lang="ts">
export interface SelectOption {
    value: string;
    label: string;
}

defineProps<{
    modelValue: string;
    options: SelectOption[];
    placeholder?: string;
}>();

defineEmits<{
    (e: "update:modelValue", value: string): void;
}>();
</script>

<template>
    <select
        class="select-input"
        :value="modelValue"
        @change="$emit('update:modelValue', ($event.target as HTMLSelectElement).value)"
    >
        <option v-if="placeholder" value="" disabled>{{ placeholder }}</option>
        <option v-for="opt in options" :key="opt.value" :value="opt.value">
            {{ opt.label }}
        </option>
    </select>
</template>

<style scoped>
.select-input {
    width: 200px;
    height: 30px;
    background: var(--dt-surface);
    border: 1px solid var(--dt-border);
    border-radius: 7px;
    color: var(--dt-foreground-secondary);
    font-size: 12px;
    padding: 0 8px;
    cursor: pointer;
    outline: none;
    flex-shrink: 0;
}
.select-input:focus {
    border-color: var(--dt-primary);
}
</style>
