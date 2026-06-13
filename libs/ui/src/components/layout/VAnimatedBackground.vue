<script lang="ts" setup>
import { onMounted, onUnmounted, ref, watch } from "vue";

interface Blob {
  x: number
  y: number
  radius: number
  vx: number
  vy: number
  color: string
}

interface Props {
  count?: number
  minRadius?: number
  maxRadius?: number
  speed?: number
  colors?: string[]
}

const {
  count = 15,
  minRadius = 100,
  maxRadius = 200,
  speed = 1,
  colors = [
    "rgba(37, 99, 235, 0.3)", // primary
    "rgba(251, 191, 36, 0.3)", // accent
    "rgba(14, 165, 233, 0.3)", // info
    "rgba(34, 197, 94, 0.3)", // success
  ],
} = defineProps<Props>();

const canvasRef = ref<HTMLCanvasElement | null>(null);
let animationFrameId: number;
let resizeHandler: (() => void) | null = null;
const blobs: Blob[] = [];

const initBlobs = (canvas: HTMLCanvasElement) => {
  blobs.length = 0;

  for (let i = 0; i < count; i++) {
    blobs.push({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height,
      radius: Math.random() * maxRadius + minRadius,
      vx: (Math.random() - 0.5) * speed,
      vy: (Math.random() - 0.5) * speed,
      color: colors[i % colors.length],
    });
  }
};

const animate = (canvas: HTMLCanvasElement, ctx: CanvasRenderingContext2D) => {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  blobs.forEach((blob) => {
    blob.x += blob.vx;
    blob.y += blob.vy;

    if (blob.x < -blob.radius || blob.x > canvas.width + blob.radius) {
      blob.vx *= -1;
    }
    if (blob.y < -blob.radius || blob.y > canvas.height + blob.radius) {
      blob.vy *= -1;
    }

    const gradient = ctx.createRadialGradient(
      blob.x,
      blob.y,
      0,
      blob.x,
      blob.y,
      blob.radius * 0.7,
    );

    // Extract RGB values and create sharper gradient with higher opacity
    const rgbMatch = blob.color.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
    if (rgbMatch) {
      const [, r, g, b] = rgbMatch;
      gradient.addColorStop(0, `rgba(${r}, ${g}, ${b}, 0.5)`);
      gradient.addColorStop(0.5, `rgba(${r}, ${g}, ${b}, 0.25)`);
      gradient.addColorStop(1, `rgba(${r}, ${g}, ${b}, 0)`);
    }

    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(blob.x, blob.y, blob.radius, 0, Math.PI * 2);
    ctx.fill();
  });

  animationFrameId = requestAnimationFrame(() => animate(canvas, ctx));
};

onMounted(() => {
  const canvas = canvasRef.value;
  if (!canvas) return;

  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  const resize = () => {
    if (!canvas) return;
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    if (blobs.length === 0) {
      initBlobs(canvas);
    }
  };

  resizeHandler = resize;
  resize();
  window.addEventListener("resize", resize);

  animate(canvas, ctx);

  watch(
    () => [count, minRadius, maxRadius, speed, colors],
    () => {
      if (canvasRef.value) {
        initBlobs(canvasRef.value);
      }
    },
    { deep: true },
  );
});

onUnmounted(() => {
  if (resizeHandler) {
    window.removeEventListener("resize", resizeHandler);
  }
  if (animationFrameId) {
    cancelAnimationFrame(animationFrameId);
  }
  blobs.length = 0;
});
</script>

<template>
  <canvas
    ref="canvasRef"
    class="fixed inset-0 z-1 pointer-events-none"
  />
  <div
    class="fixed inset-0 z-1 bg-linear-to-br from-primary/5 via-accent/5 to-info/5"
  />
</template>
