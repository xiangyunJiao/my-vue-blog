<script setup lang="ts">
import { computed } from 'vue';

withDefaults(
  defineProps<{
    dark?: boolean;
  }>(),
  { dark: false }
);

/** 随机但稳定的星点 */
const starLayers = computed(() => {
  const mk = (seed: number, count: number, opacity: number, size: number) => {
    const out: string[] = [];
    let s = seed;
    const rnd = () => {
      s = (s * 9301 + 49297) % 233280;
      return s / 233280;
    };
    for (let i = 0; i < count; i++) {
      const x = rnd() * 100;
      const y = rnd() * 100;
      const a = opacity * (0.55 + rnd() * 0.45);
      out.push(
        `radial-gradient(${size}px ${size}px at ${x}% ${y}%, rgba(255,255,255,${a.toFixed(3)}), transparent)`
      );
    }
    return out;
  };
  return [...mk(11, 100, 0.7, 1), ...mk(29, 55, 0.5, 1.5), ...mk(47, 18, 0.95, 2.5)].join(',');
});

/** 统一方向：左上 → 右下；远景略短略淡；细长拖尾由 CSS 多层渐变 + ::after 实现 */
const meteors = computed(() =>
  Array.from({ length: 44 }, (_, i) => {
    const left = ((i * 43 + 17) % 91) + 4.5;
    const top = -5 - (i % 9) * 1.8;
    const delay = ((i * 0.39) % 13) + (i % 4) * 0.12;
    const duration = 2.6 + (i % 12) * 0.48;
    const far = i % 4 === 0;
    const height = far ? 110 + (i % 6) * 12 : 168 + (i % 9) * 14;
    const opacity = far ? 0.42 + (i % 3) * 0.05 : 0.62 + (i % 5) * 0.05;
    return {
      id: i,
      left: `${left}%`,
      top: `${top}vh`,
      delay: `${delay}s`,
      duration: `${duration}s`,
      height: `${height}px`,
      opacity: String(opacity),
      far,
    };
  })
);
</script>

<template>
  <div class="starfield-root" :class="{ 'starfield--dark': dark }" aria-hidden="true">
    <div class="starfield-sky" />
    <div class="starfield-nebula" />
    <div class="starfield-aurora" />
    <div class="starfield-stars" :style="{ backgroundImage: starLayers }" />
    <div class="meteor-layer">
      <div
        v-for="m in meteors"
        :key="m.id"
        class="meteor"
        :class="{ 'meteor--far': m.far }"
        :style="{
          left: m.left,
          top: m.top,
          animationDelay: m.delay,
          animationDuration: m.duration,
          height: m.height,
          '--meteor-opacity': m.opacity,
        }"
      />
    </div>
  </div>
</template>

<style scoped>
.starfield-root {
  position: fixed;
  inset: 0;
  z-index: 0;
  pointer-events: none;
  overflow: hidden;
}

.starfield-sky {
  position: absolute;
  inset: 0;
  background: linear-gradient(
    180deg,
    #2d3a6e 0%,
    #243056 18%,
    #1a2548 40%,
    #152038 65%,
    #121a32 100%
  );
}

.starfield--dark .starfield-sky {
  background: linear-gradient(
    180deg,
    #1e2848 0%,
    #181f3d 25%,
    #12182e 55%,
    #0c1020 100%
  );
}

.starfield-nebula {
  position: absolute;
  inset: -15%;
  background:
    radial-gradient(ellipse 90% 55% at 15% 20%, rgba(129, 140, 248, 0.38), transparent 52%),
    radial-gradient(ellipse 75% 50% at 85% 15%, rgba(167, 139, 250, 0.32), transparent 48%),
    radial-gradient(ellipse 65% 45% at 50% 75%, rgba(56, 189, 248, 0.22), transparent 42%),
    radial-gradient(ellipse 55% 40% at 72% 45%, rgba(244, 114, 182, 0.12), transparent 38%);
  opacity: 1;
  animation: nebula-drift 28s ease-in-out infinite alternate;
}

.starfield--dark .starfield-nebula {
  background:
    radial-gradient(ellipse 88% 52% at 12% 22%, rgba(99, 102, 241, 0.28), transparent 52%),
    radial-gradient(ellipse 78% 48% at 88% 12%, rgba(139, 92, 246, 0.24), transparent 48%),
    radial-gradient(ellipse 68% 46% at 48% 78%, rgba(34, 211, 238, 0.14), transparent 42%);
  opacity: 0.95;
}

@keyframes nebula-drift {
  0% {
    transform: translate(0, 0) scale(1);
  }
  33% {
    transform: translate(1.5%, -0.8%) scale(1.015);
  }
  66% {
    transform: translate(-1.2%, 1%) scale(1.008);
  }
  100% {
    transform: translate(0.4%, 0.3%) scale(1);
  }
}

/* 底层极光感：缓慢扫过的青紫带 */
.starfield-aurora {
  position: absolute;
  inset: -30% -20%;
  background: linear-gradient(
    105deg,
    transparent 0%,
    rgba(34, 211, 238, 0.06) 25%,
    rgba(167, 139, 250, 0.09) 50%,
    rgba(56, 189, 248, 0.07) 72%,
    transparent 100%
  );
  opacity: 0.85;
  filter: blur(28px);
  animation: aurora-sweep 18s ease-in-out infinite;
  pointer-events: none;
}

.starfield--dark .starfield-aurora {
  opacity: 0.65;
}

@keyframes aurora-sweep {
  0%,
  100% {
    transform: translateX(-4%) skewX(-2deg);
    opacity: 0.75;
  }
  50% {
    transform: translateX(5%) skewX(1deg);
    opacity: 0.95;
  }
}

.starfield-stars {
  position: absolute;
  inset: 0;
  background-repeat: no-repeat;
  background-size: 100% 100%;
  animation: twinkle 7s ease-in-out infinite;
}

@keyframes twinkle {
  0%,
  100% {
    opacity: 0.88;
  }
  50% {
    opacity: 1;
  }
}

.meteor-layer {
  position: absolute;
  inset: 0;
  mix-blend-mode: normal;
  opacity: 0.88;
}

/*
 * 统一左上 → 右下；仅保留中心细长光芯 + 渐变拖尾，不用宽条与 box-shadow，避免出现「方框边框」
 */
.meteor {
  --meteor-angle: -42deg;
  --meteor-opacity: 0.72;
  position: absolute;
  transform-origin: 50% 0%;
  width: 1px;
  height: 200px;
  margin-left: 0;
  border: none;
  border-radius: 0;
  background: linear-gradient(
    to bottom,
    rgba(255, 255, 255, 1) 0%,
    rgba(248, 250, 255, 0.92) 5%,
    rgba(224, 242, 254, 0.45) 22%,
    rgba(186, 230, 253, 0.18) 48%,
    rgba(125, 211, 252, 0.06) 72%,
    transparent 100%
  );
  box-shadow: none;
  opacity: 0;
  will-change: transform, opacity;
  animation: meteor-diagonal linear infinite;
}

.meteor::before {
  content: '';
  position: absolute;
  top: 0;
  left: 50%;
  width: 2px;
  height: 2px;
  margin-left: -1px;
  border-radius: 50%;
  background: #fff;
  /* 仅保留弹头微光，避免大光晕形成外圈方框感 */
  box-shadow: 0 0 3px 1px rgba(255, 255, 255, 0.75);
}

.meteor--far {
  filter: blur(0.2px);
}

.meteor--far::before {
  width: 1.5px;
  height: 1.5px;
  margin-left: -0.75px;
  box-shadow: 0 0 2px rgba(255, 255, 255, 0.55);
}

@keyframes meteor-diagonal {
  0% {
    transform: translateX(-50%) rotate(var(--meteor-angle)) translateY(-28vh);
    opacity: 0;
  }
  5% {
    opacity: var(--meteor-opacity);
  }
  88% {
    opacity: 0.72;
  }
  100% {
    transform: translateX(-50%) rotate(var(--meteor-angle)) translateY(128vh);
    opacity: 0;
  }
}

@media (prefers-reduced-motion: reduce) {
  .starfield-stars,
  .starfield-nebula,
  .starfield-aurora {
    animation: none;
  }
  .meteor-layer {
    display: none;
  }
}
</style>
