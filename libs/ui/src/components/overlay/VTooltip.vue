<script lang="ts" setup>
import { computed, ref, nextTick } from "vue";

interface Props {
  /** Tooltip text */
  text: string
  /** Render `text` as HTML (dangerous without sanitizing) */
  allowHtml?: boolean
  /** Placement of tooltip */
  placement?: "top" | "bottom" | "left" | "right"
  /** Delay before showing tooltip (ms) */
  delay?: number
  /** Disabled state */
  disabled?: boolean
  /** Custom class for tooltip content */
  tooltipClass?: string
  /** Custom class for wrapper element */
  wrapperClass?: string
  /** Maximum width of tooltip (e.g., '500px', '20rem') */
  maxWidth?: string
}

const {
  text,
  allowHtml = false,
  placement = "right",
  delay = 300,
  disabled = false,
  tooltipClass = "",
  wrapperClass = "",
  maxWidth = "800px",
} = defineProps<Props>();

const EDGE_PADDING = 12; // Minimum distance from screen edges
const TOOLTIP_OFFSET = 8; // Distance between trigger and tooltip
const MIN_TOOLTIP_WIDTH = 200; // Minimum tooltip width to prevent excessive shrinking

const isVisible = ref(false);
const timeout = ref<ReturnType<typeof setTimeout> | null>(null);
const triggerRef = ref<HTMLElement | null>(null);
const tooltipRef = ref<HTMLElement | null>(null);
const tooltipPosition = ref({ top: 0, left: 0 });
const actualPlacement = ref(placement);
const calculatedMaxWidth = ref<string | null>(null);

/**
 * Calculate optimal placement based on available space
 */
const getOptimalPlacement = (
  rect: DOMRect,
  tooltipWidth: number,
  tooltipHeight: number,
  viewportWidth: number,
  viewportHeight: number,
  preferredPlacement: Props["placement"],
): Props["placement"] => {
  const spaceTop = rect.top;
  const spaceBottom = viewportHeight - rect.bottom;
  const spaceLeft = rect.left;
  const spaceRight = viewportWidth - rect.right;

  const canFitTop = spaceTop >= tooltipHeight + TOOLTIP_OFFSET + EDGE_PADDING;
  const canFitBottom = spaceBottom >= tooltipHeight + TOOLTIP_OFFSET + EDGE_PADDING;
  const canFitLeft = spaceLeft >= tooltipWidth + TOOLTIP_OFFSET + EDGE_PADDING;
  const canFitRight = spaceRight >= tooltipWidth + TOOLTIP_OFFSET + EDGE_PADDING;

  // Try preferred placement first
  if (preferredPlacement === "top" && canFitTop) return "top";
  if (preferredPlacement === "bottom" && canFitBottom) return "bottom";
  if (preferredPlacement === "left" && canFitLeft) return "left";
  if (preferredPlacement === "right" && canFitRight) return "right";

  // Find the best alternative based on available space
  const placements: Array<{ placement: Props["placement"], fits: boolean, space: number }> = [
    { placement: "right", fits: canFitRight, space: spaceRight },
    { placement: "left", fits: canFitLeft, space: spaceLeft },
    { placement: "bottom", fits: canFitBottom, space: spaceBottom },
    { placement: "top", fits: canFitTop, space: spaceTop },
  ];

  // Return first fitting placement or the one with most space
  const fitting = placements.find(p => p.fits);
  if (fitting) return fitting.placement;

  // If nothing fits perfectly, return the one with most space
  placements.sort((a, b) => b.space - a.space);
  return placements[0].placement;
};

/**
 * Calculate tooltip position with edge detection and repositioning
 */
const calculatePosition = async () => {
  if (!triggerRef.value) return;

  const rect = triggerRef.value.getBoundingClientRect();
  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;

  // Reset max width
  calculatedMaxWidth.value = null;

  // Set initial position off-screen to measure tooltip
  tooltipPosition.value = { top: -9999, left: -9999 };
  actualPlacement.value = placement;

  await nextTick();

  if (!tooltipRef.value) return;

  const tooltipRect = tooltipRef.value.getBoundingClientRect();
  const tooltipWidth = Math.max(tooltipRect.width, MIN_TOOLTIP_WIDTH);
  const tooltipHeight = tooltipRect.height;

  // Get optimal placement
  const optimalPlacement = getOptimalPlacement(
    rect,
    tooltipWidth,
    tooltipHeight,
    viewportWidth,
    viewportHeight,
    placement,
  );

  let top: number;
  let left: number;

  // Calculate position based on placement
  switch (optimalPlacement) {
    case "top":
      top = rect.top - TOOLTIP_OFFSET - tooltipHeight;
      left = rect.left + rect.width / 2 - tooltipWidth / 2;
      break;
    case "bottom":
      top = rect.bottom + TOOLTIP_OFFSET;
      left = rect.left + rect.width / 2 - tooltipWidth / 2;
      break;
    case "left":
      top = rect.top + rect.height / 2 - tooltipHeight / 2;
      left = rect.left - TOOLTIP_OFFSET - tooltipWidth;
      break;
    case "right":
    default:
      top = rect.top + rect.height / 2 - tooltipHeight / 2;
      left = rect.right + TOOLTIP_OFFSET;
      break;
  }

  // Clamp horizontal position to viewport bounds
  const maxLeft = viewportWidth - tooltipWidth - EDGE_PADDING;
  left = Math.max(EDGE_PADDING, Math.min(left, maxLeft));

  // Clamp vertical position to viewport bounds
  const maxTop = viewportHeight - tooltipHeight - EDGE_PADDING;
  top = Math.max(EDGE_PADDING, Math.min(top, maxTop));

  // Calculate available width if tooltip would overflow
  const availableWidth = viewportWidth - EDGE_PADDING * 2;
  if (tooltipWidth > availableWidth) {
    calculatedMaxWidth.value = `${availableWidth}px`;
  }

  tooltipPosition.value = { top, left };
  if (optimalPlacement) {
    actualPlacement.value = optimalPlacement;
  }
};

const showTooltip = () => {
  if (disabled || !text) return;

  timeout.value = setTimeout(async () => {
    isVisible.value = true;
    await nextTick();
    calculatePosition();
  }, delay);
};

const hideTooltip = () => {
  if (timeout.value) {
    clearTimeout(timeout.value);
    timeout.value = null;
  }
  isVisible.value = false;
  actualPlacement.value = placement;
};

/**
 * Dynamic styles for tooltip positioning
 */
const tooltipStyles = computed(() => ({
  top: `${tooltipPosition.value.top}px`,
  left: `${tooltipPosition.value.left}px`,
  maxWidth: calculatedMaxWidth.value ?? maxWidth,
}));
</script>

<template>
  <div
    ref="triggerRef"
    :class="['v-tooltip', wrapperClass]"
    @blur="hideTooltip"
    @focus="showTooltip"
    @mouseenter="showTooltip"
    @mouseleave="hideTooltip"
  >
    <!-- Trigger Element -->
    <slot />

    <!-- Tooltip (Teleported to body) -->
    <Teleport to="body">
      <Transition name="v-tooltip-fade">
        <div
          v-if="isVisible && text"
          ref="tooltipRef"
          :style="tooltipStyles"
          class="v-tooltip__popper"
        >
          <div :class="['v-tooltip__body', tooltipClass]">
            <span
              v-if="allowHtml"
              v-html="text"
            />
            <span v-else>{{ text }}</span>
          </div>
        </div>
      </Transition>
    </Teleport>
  </div>
</template>

<style scoped>
@import "../../styles/components/overlay/vtooltip.scss";
</style>
