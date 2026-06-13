<script lang="ts" setup>
import { useSlots, type Slots } from "vue";

import { type ModelValue, VueDatePicker } from "@vuepic/vue-datepicker";

import "@vuepic/vue-datepicker/dist/main.css";

import type { FieldValidation } from "../../types/validation";
import VIcon from "../base/VIcon.vue";

defineOptions({
  inheritAttrs: false,
});

const {
  name = "",
  helperText = "",
  validation = undefined,
  size = "md",
  icon = "lucide:calendar",
  autoApply = true,
  clearable = false,
  width = undefined,
} = defineProps<{
  /** Label for the datepicker (wrapper UI) */
  name?: string
  /** Helper text below input (wrapper UI) */
  helperText?: string
  /** Validation object (Vuelidate compatible) */
  validation?: FieldValidation
  /** Size variant: sm / md / lg */
  size?: "sm" | "md" | "lg"
  /** Icon to display in the input */
  icon?: string
  /** Auto apply selection (no confirm button) */
  autoApply?: boolean
  clearable?: boolean
  width?: string
}>();

const model = defineModel<ModelValue>();
const slots: Slots = useSlots();

// Slots with custom default implementations — do not pass-through
const excludedSlots = [
  "input-icon",
  "clear-icon",
  "arrow-left",
  "arrow-right",
  "arrow-up",
  "arrow-down",
  "clock-icon",
  "calendar-icon",
];
</script>

<template>
  <div
    :class="`v-datepicker--${size}`"
    :style="{ width }"
    class="v-datepicker-wrapper"
  >
    <!-- Label -->
    <label
      v-if="name"
      class="v-datepicker-label"
    >
      {{ name }}
    </label>

    <!-- Datepicker — library props via $attrs -->
    <VueDatePicker
      v-model="model"
      :auto-apply="autoApply"
      :calendar-class-name="'v-datepicker-calendar'"
      :class="[
        'v-datepicker',
        {
          'v-datepicker-error': validation?.$error,
          'v-datepicker-no-clear': !clearable,
        },
      ]"
      :input-class-name="[
        'v-datepicker-input',
        { 'v-datepicker-input-error': validation?.$error },
      ]"
      :menu-class-name="'v-datepicker-menu'"
      :timezone="'UTC'"
      :week-start="0"
      v-bind="$attrs"
    >
      <!-- Input Icon -->
      <template
        v-if="slots['input-icon']"
        #input-icon
      >
        <slot name="input-icon" />
      </template>
      <template
        v-else
        #input-icon
      >
        <div class="v-datepicker-icon-wrapper">
          <VIcon
            :icon="icon"
            class="v-datepicker-icon"
          />
        </div>
      </template>

      <!-- Clear Icon -->
      <template
        v-if="!clearable"
        #clear-icon
      />
      <template
        v-else-if="clearable && slots['clear-icon']"
        #clear-icon="slotProps"
      >
        <slot
          name="clear-icon"
          v-bind="slotProps"
        />
      </template>
      <template
        v-else
        #clear-icon="{ clear }"
      >
        <div class="v-datepicker-clear-wrapper">
          <VIcon
            class="v-datepicker-clear-icon"
            icon="lucide:x"
            @click="clear"
          />
        </div>
      </template>

      <!-- Arrow Left -->
      <template
        v-if="slots['arrow-left']"
        #arrow-left
      >
        <slot name="arrow-left" />
      </template>
      <template
        v-else
        #arrow-left
      >
        <VIcon
          class="v-datepicker-arrow-icon"
          icon="lucide:chevron-left"
        />
      </template>

      <!-- Arrow Right -->
      <template
        v-if="slots['arrow-right']"
        #arrow-right
      >
        <slot name="arrow-right" />
      </template>
      <template
        v-else
        #arrow-right
      >
        <VIcon
          class="v-datepicker-arrow-icon"
          icon="lucide:chevron-right"
        />
      </template>

      <!-- Arrow Up -->
      <template
        v-if="slots['arrow-up']"
        #arrow-up
      >
        <slot name="arrow-up" />
      </template>
      <template
        v-else
        #arrow-up
      >
        <VIcon
          class="v-datepicker-arrow-icon"
          icon="lucide:chevron-up"
        />
      </template>

      <!-- Arrow Down -->
      <template
        v-if="slots['arrow-down']"
        #arrow-down
      >
        <slot name="arrow-down" />
      </template>
      <template
        v-else
        #arrow-down
      >
        <VIcon
          class="v-datepicker-arrow-icon"
          icon="lucide:chevron-down"
        />
      </template>

      <!-- Clock Icon -->
      <template
        v-if="slots['clock-icon']"
        #clock-icon
      >
        <slot name="clock-icon" />
      </template>
      <template
        v-else
        #clock-icon
      >
        <VIcon
          class="v-datepicker-clock-icon"
          icon="lucide:clock"
        />
      </template>

      <!-- Calendar Icon -->
      <template
        v-if="slots['calendar-icon']"
        #calendar-icon
      >
        <slot name="calendar-icon" />
      </template>
      <template
        v-else
        #calendar-icon
      >
        <VIcon
          :icon="icon"
          class="v-datepicker-calendar-icon"
        />
      </template>

      <!-- Pass-through any other slots from parent -->
      <template
        v-for="(_slotValue, slotName) in slots"
        :key="slotName"
        #[slotName]="slotProps"
      >
        <slot
          v-if="!excludedSlots.includes(slotName as string)"
          :name="slotName"
          v-bind="slotProps"
        />
      </template>
    </VueDatePicker>

    <!-- Helper Text -->
    <p
      v-if="helperText && !validation?.$error"
      class="v-datepicker-helper-text"
    >
      {{ helperText }}
    </p>

    <!-- Error Message -->
    <transition
      mode="out-in"
      name="error-slide"
    >
      <p
        v-if="validation?.$error"
        class="form-error"
      >
        {{ validation?.$errors?.[0]?.$message }}
      </p>
    </transition>
  </div>
</template>

<style>
@layer components {
  :where(.v-datepicker-wrapper) {
    width: fit-content;
  }
}
</style>

<style scoped>
@import "../../styles/components/inputs/vdatepicker.scss";
</style>
