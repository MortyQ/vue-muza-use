<script lang="ts" setup>
import { ref, computed, useId, useSlots, watch } from "vue";

import { useDebounceFn } from "@vueuse/core";

import type { FieldValidation } from "../../types/validation";
import VIcon from "../base/VIcon.vue";

defineOptions({ inheritAttrs: false });

const {
  name = "",
  type = "text",
  placeholder = "",
  disabled = false,
  helperText = "",
  validation = undefined,
  icon = "",
  size = "md",
  id = undefined,
  debounce = false,
  loading = false,
  textarea = false,
  rows = 4,
  showClearButton: showClearButtonProp = true,
} = defineProps<{
  name?: string
  type?: "text" | "password" | "email" | "number" | "search" | "tel" | "url" | "date"
  placeholder?: string
  disabled?: boolean
  helperText?: string
  validation?: FieldValidation
  icon?: string
  size?: "sm" | "md" | "lg"
  id?: string
  /**
   * Debounce delay in ms. Static — evaluated once on mount.
   * Changing this prop at runtime has no effect.
   */
  debounce?: boolean | number
  loading?: boolean
  textarea?: boolean
  rows?: number
  showClearButton?: boolean
}>();

const emit = defineEmits<{ clear: [] }>();

const model = defineModel<string | number | undefined>();

const slots: ReturnType<typeof useSlots> = useSlots();
const generatedId = useId();

const isShowPassword = ref(false);
const isFocused = ref(false);
const inputRef = ref<HTMLInputElement | HTMLTextAreaElement | null>(null);

const inputId = computed(() => id || `v-input-${generatedId}`);

const delay = typeof debounce === "number" ? debounce : debounce ? 800 : 0;

const localValue = ref<string | number>(model.value ?? "");

watch(model, (newVal) => {
  if (newVal !== localValue.value) {
    localValue.value = newVal ?? "";
  }
});

// NOTE: external model reset while debounce is pending will be overridden
// by the debounced update. Acceptable tradeoff — no programmatic resets
// happen while user is actively typing in current usage.
const updateModel = useDebounceFn((val: string | number | undefined) => {
  model.value = val;
}, delay);

const handleInput = (event: Event) => {
  const val = (event.target as HTMLInputElement | HTMLTextAreaElement).value;

  localValue.value = val;

  let finalVal: string | number | undefined = val;

  if (type === "number" && val !== "") {
    const num = Number(val);
    if (!isNaN(num)) finalVal = num;
  }

  updateModel(finalVal);
};

const clearInput = () => {
  localValue.value = "";
  model.value = type === "number" ? undefined : "";
  emit("clear");
  inputRef.value?.focus();
};

const currentInputType = computed(() => {
  if (type === "password") return isShowPassword.value ? "text" : "password";
  return type;
});

const changeInputType = () => {
  isShowPassword.value = !isShowPassword.value;
};

const sizeClass = computed(() => ({
  sm: "v-input-field--sm",
  md: "v-input-field--md",
  lg: "v-input-field--lg",
}[size]));

const isSearchType = computed(() => type === "search");

const showClearButton = computed(() => {
  if (type === "password" || !showClearButtonProp) return false;

  if (delay > 0) {
    return model.value !== "" && model.value !== null && model.value !== undefined;
  }

  return localValue.value !== "";
});

const showLeftIcon = computed(() => icon || isSearchType.value || !!slots["icon-left"] || loading);
const showRightIcon = computed<boolean>(() => type === "password" || showClearButton.value || !!slots["icon-right"]);

const leftIconName = computed(() => {
  if (icon) return icon;
  if (isSearchType.value) return "lucide:search";
  return "";
});

const hasValue = computed(() =>
  localValue.value !== "" && localValue.value !== null && localValue.value !== undefined,
);

const computedPlaceholder = computed(() => {
  if (!name) return placeholder;
  return isFocused.value ? placeholder : "";
});

</script>

<template>
  <div class="v-input-wrapper">
    <!-- Input Container -->
    <div class="v-input-container">
      <!-- Floating Label -->
      <label
        v-if="name"
        :class="[
          'v-label',
          {
            'v-label--active': isFocused || hasValue,
            'v-label--error': validation?.$error,
            'v-label--with-icon': showLeftIcon && !(isFocused || hasValue),
            'v-label--textarea': textarea
          }
        ]"
        :for="inputId"
      >
        {{ name }}
      </label>

      <!-- Left Icon -->
      <div
        v-if="showLeftIcon"
        :class="[
          'v-input-icon v-input-icon-left',
          {
            'v-input-icon-textarea': textarea,
            'v-input-icon--active': isFocused || loading
          }
        ]"
      >
        <slot name="icon-left">
          <VIcon
            v-if="leftIconName || loading"
            :class="{
              'text-danger': validation?.$error
            }"
            :icon="leftIconName"
            :loading="loading"
            class="v-input-icon-svg"
          />
        </slot>
      </div>

      <!-- Input / Textarea Field -->
      <component
        :is="textarea ? 'textarea' : 'input'"
        :id="inputId"
        ref="inputRef"
        :aria-describedby="validation?.$error ? `${inputId}-error`
          : helperText ? `${inputId}-helper` : undefined"
        :aria-invalid="validation?.$error || undefined"
        :class="[
          'v-input-field',
          sizeClass,
          {
            'v-input-field--textarea': textarea,
            'v-input-field--with-left-icon': showLeftIcon,
            'v-input-field--with-right-icon': showRightIcon,
            'v-input-field--date': type === 'date' && !textarea,
            'v-input-field--disabled': disabled,
          },
        ]"
        :disabled="disabled"
        :placeholder="computedPlaceholder"
        :value="localValue"
        v-bind="{
          ...$attrs,
          type: textarea ? undefined : currentInputType,
          rows: textarea ? rows : undefined,
        }"
        @blur="isFocused = false"
        @focus="isFocused = true"
        @input="handleInput"
      />

      <!-- Right Icon / Actions -->
      <div
        v-if="showRightIcon"
        :class="[
          'v-input-icon v-input-icon-right',
          { 'v-input-icon-textarea': textarea }
        ]"
      >
        <slot name="icon-right">
          <!-- Clear Button -->
          <button
            v-if="showClearButton"
            aria-label="Clear input"
            class="v-input-clear-btn"
            type="button"
            @click="clearInput"
          >
            <VIcon
              class="v-input-icon-svg v-input-icon-svg--sm"
              icon="lucide:x"
            />
          </button>

          <!-- Password Toggle -->
          <div
            v-else-if="type === 'password'"
            class="v-input-password-toggle"
            role="button"
            tabindex="0"
            @click="changeInputType"
            @keydown.enter.space="changeInputType"
          >
            <VIcon
              :icon="currentInputType === 'text' ? 'lucide:eye-off' : 'lucide:eye'"
              class="v-input-icon-svg"
            />
          </div>
        </slot>
      </div>

      <!-- Fieldset Border -->
      <fieldset
        :class="[
          'v-fieldset',
          {
            'v-fieldset--active': isFocused,
            'v-fieldset--error': validation?.$error,
            'v-fieldset--disabled': disabled
          }
        ]"
        aria-hidden="true"
      >
        <legend
          :class="['v-legend', { 'v-legend--visible': name && (hasValue || isFocused) }]"
        >
          <span>{{ name }}</span>
        </legend>
      </fieldset>
    </div>

    <!-- Helper Text -->
    <slot name="helper-text">
      <p
        v-if="helperText && !validation?.$error"
        class="v-input-helper-text"
      >
        {{ helperText }}
      </p>
    </slot>

    <!-- Error Message -->
    <transition
      mode="out-in"
      name="error-slide"
    >
      <slot name="error-message">
        <p
          v-if="validation?.$error"
          class="v-input-error-message"
        >
          {{ String(validation?.$errors[0]?.$message ?? '') }}
        </p>
      </slot>
    </transition>
  </div>
</template>

<style scoped>
@import "../../styles/components/inputs/vinput.scss";
</style>
