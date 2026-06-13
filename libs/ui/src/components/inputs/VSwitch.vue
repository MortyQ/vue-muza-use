<script lang="ts" setup>
import { computed, useId } from "vue";

import VIcon from "../base/VIcon.vue";

defineOptions({ inheritAttrs: false });

const {
  disabled = false,
  trueIcon = undefined,
  falseIcon = undefined,
  trueLabel = undefined,
  falseLabel = undefined,
  color = undefined,
  id = undefined,
} = defineProps<{
  disabled?: boolean
  trueIcon?: string
  falseIcon?: string
  trueLabel?: string
  falseLabel?: string
  /** Custom hex/CSS color for the checked track (overrides --ui-primary) */
  color?: string
  id?: string
}>();

const model = defineModel<boolean>({ default: false });

const generatedId = useId();
const inputId = computed(() => id || generatedId);
</script>

<template>
  <label
    :class="{ 'v-switch--disabled': disabled }"
    :for="inputId"
    class="v-switch"
  >
    <span class="v-switch__container">
      <input
        :id="inputId"
        :checked="model"
        :disabled="disabled"
        class="v-switch__input"
        type="checkbox"
        v-bind="$attrs"
        @change="model = ($event.target as HTMLInputElement).checked"
      >
      <span
        :class="[
          'v-switch__track',
          { 'v-switch__track--checked': model },
          { 'v-switch__track--disabled': disabled },
          { 'v-switch__track--custom-color': !!color && model && !disabled }
        ]"
        :style="color && model && !disabled ? { '--v-switch-color': color } : undefined"
      >
        <span
          :class="['v-switch__thumb', { 'v-switch__thumb--checked': model }]"
        >
          <slot
            v-if="$slots.icon"
            name="icon"
          >
            <slot :name="model ? 'true-icon' : 'false-icon'" />
          </slot>
          <template v-else>
            <VIcon
              v-if="model && trueIcon"
              :icon="trueIcon"
              :size="16"
            />
            <VIcon
              v-else-if="!model && falseIcon"
              :icon="falseIcon"
              :size="16"
            />
          </template>
        </span>
      </span>
    </span>
    <span class="v-switch__label">
      <slot>
        {{ model ? trueLabel : falseLabel }}
      </slot>
    </span>
  </label>
</template>

<style scoped>
@import "../../styles/components/inputs/vswitch.scss";
</style>
