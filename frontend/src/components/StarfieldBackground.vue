<script setup lang="ts">
import { computed, ref, onMounted, onUnmounted } from 'vue';

/**
 * 星空背景（原理：几乎纯 CSS）
 * - 天幕/星云/极光：多层 div + linear/radial-gradient 与 @keyframes transform/opacity
 * - 星点：单 div 的 background-image 叠加大量 radial-gradient（较耗合成层，已控制数量）
 * - 流星：若干 div，每条为 1px 宽 + linear-gradient 拖尾 + ::before 弹头，animation 只做 transform/opacity（GPU 友好）
 * Vue 仅负责：根据暗色切换 class、生成稳定随机参数、绑定 style
 */
withDefaults(
  defineProps<{
    dark?: boolean;
  }>(),
  { dark: false }
);

/** 随机但稳定的星点（数量已压缩，减轻单层超大 background 绘制压力） */
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
  return [...mk(11, 52, 0.7, 1), ...mk(29, 30, 0.5, 1.5), ...mk(47, 12, 0.95, 2.5)].join(',');
});

/**
 * 左上 → 右下同一族平行线；约 1/3 条刻意偏左（锚点 1%～32%），让轨迹掠过左下区域；
 * 略调 --meteor-angle 打散平行束，避免左下角被「束外」空出来。
 * 窄屏（手机）同屏面积小、同条数会显得「更稀」，故单独加条数。
 */
const METEOR_COUNT_DESKTOP = 32;
const METEOR_COUNT_NARROW = 54;

const ANGLES = ['-44deg', '-42deg', '-40deg', '-39deg'];

const isNarrowViewport = ref(
  typeof window !== 'undefined' && window.matchMedia('(max-width: 768px)').matches
);

function updateNarrowViewport() {
  if (typeof window === 'undefined') return;
  isNarrowViewport.value = window.matchMedia('(max-width: 768px)').matches;
}

let narrowMql: MediaQueryList | undefined;

onMounted(() => {
  updateNarrowViewport();
  if (typeof window === 'undefined') return;
  narrowMql = window.matchMedia('(max-width: 768px)');
  narrowMql.addEventListener('change', updateNarrowViewport);
});

onUnmounted(() => {
  narrowMql?.removeEventListener('change', updateNarrowViewport);
});

const meteors = computed(() => {
  const n = isNarrowViewport.value ? METEOR_COUNT_NARROW : METEOR_COUNT_DESKTOP;
  return Array.from({ length: n }, (_, i) => {
    const leftBias = i % 3 === 0;
    const left = leftBias
      ? 1 + ((i * 79) % 310) / 10
      : 24 + ((i * 47 + 19) % 730) / 10;
    /* 起点略向下铺开，配合更长下落轨迹，让中下屏也有流星穿过 */
    const top = leftBias ? -36 - (i % 9) * 3 : -6 - (i % 11) * 2.9;
    const delay = ((i * 0.41) % 13) + (i % 4) * 0.12;
    const duration = 2.6 + (i % 12) * 0.48;
    const far = i % 4 === 0;
    const height = far ? 110 + (i % 6) * 12 : 168 + (i % 9) * 14;
    const opacity = far ? 0.42 + (i % 3) * 0.05 : 0.62 + (i % 5) * 0.05;
    const angle = ANGLES[i % ANGLES.length];
    return {
      id: i,
      left: `${Math.min(98, Math.max(0.5, left)).toFixed(2)}%`,
      top: `${top}vh`,
      delay: `${delay}s`,
      duration: `${duration}s`,
      height: `${height}px`,
      opacity: String(opacity),
      angle,
      far,
    };
  });
});
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
          '--meteor-angle': m.angle,
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
  /* 独立合成层，减少与前景文档的交错重绘 */
  transform: translateZ(0);
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
  filter: blur(20px);
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
  animation: twinkle 9s ease-in-out infinite;
  contain: strict;
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

/* 底部多留负边，避免长轨迹在页面下缘被裁切 */
.meteor-layer {
  position: absolute;
  top: -24vh;
  right: -10vw;
  bottom: -62vh;
  left: -10vw;
  mix-blend-mode: normal;
  opacity: 0.88;
  transform: translateZ(0);
  contain: layout style;
}

@media (max-width: 768px) {
  .meteor-layer {
    opacity: 0.94;
    top: -28vh;
    right: -12vw;
    bottom: -72vh;
    left: -12vw;
  }
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
    transparent 0%,
    rgba(125, 211, 252, 0.06) 28%,
    rgba(186, 230, 253, 0.18) 52%,
    rgba(224, 242, 254, 0.45) 78%,
    rgba(248, 250, 255, 0.92) 95%,
    rgba(255, 255, 255, 1) 100%
  );
  box-shadow: none;
  opacity: 0;
  animation: meteor-diagonal linear infinite;
}

.meteor::before {
  content: '';
  position: absolute;
  bottom: 0;
  left: 50%;
  width: 2px;
  height: 2px;
  margin-left: -1px;
  border-radius: 50%;
  background: #fff;
  /* 仅保留弹头微光，避免大光晕形成外圈方框感 */
  box-shadow: 0 0 3px 1px rgba(255, 255, 255, 0.75);
}

/* 远景不再用 filter，避免每颗流星单独走模糊合成 */

.meteor--far::before {
  width: 1.5px;
  height: 1.5px;
  margin-left: -0.75px;
  box-shadow: 0 0 2px rgba(255, 255, 255, 0.55);
}

@keyframes meteor-diagonal {
  0% {
    transform: translateX(-50%) rotate(var(--meteor-angle)) translateY(-52vh);
    opacity: 0;
  }
  5% {
    opacity: var(--meteor-opacity);
  }
  88% {
    opacity: 0.72;
  }
  100% {
    /* 总位移约 226vh，整体更偏向下半屏与视口下方 */
    transform: translateX(-50%) rotate(var(--meteor-angle)) translateY(174vh);
    opacity: 0;
  }
}

/* 手机竖屏：可视高度受地址栏影响，略拉长轨迹，减少「划一下就没了」的感觉 */
@media (max-width: 768px) {
  @keyframes meteor-diagonal {
    0% {
      transform: translateX(-50%) rotate(var(--meteor-angle)) translateY(-58vh);
      opacity: 0;
    }
    5% {
      opacity: var(--meteor-opacity);
    }
    88% {
      opacity: 0.72;
    }
    100% {
      transform: translateX(-50%) rotate(var(--meteor-angle)) translateY(192vh);
      opacity: 0;
    }
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
