<template>
  <div class="host3d" :class="{ fullscreen: isFullscreen }">
    <button class="fs-btn" @click="toggleFullscreen" :title="isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'">
      {{ isFullscreen ? '⤫' : '⤢' }}
    </button>
    <canvas ref="canvasRef" class="host-canvas"></canvas>
  </div>
</template>

<script setup lang="ts">
import { onMounted, onUnmounted, ref, watch, nextTick } from 'vue'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { createFeatureExtractor } from '../../engine/features'
import { registry, type LayerContext } from '../../engine/layers'
import '../../layers/Layer.RadialBasic3D'
import '../../layers/Layer.CannonFireworks3D'
import '../../layers/Layer.AudioDebugBars3D'
import '../../layers/Layer.SynthwaveWorld3d'

interface Props {
  fft: Float32Array
  rms?: number
  sampleRate: number
  activeLayerIds: string[]
  sourceVersion?: number
}
const props = defineProps<Props>()

const canvasRef = ref<HTMLCanvasElement>()
let scene: THREE.Scene
let camera: THREE.PerspectiveCamera
let renderer: THREE.WebGLRenderer
let ctx: LayerContext
let rafId = 0
let controls: OrbitControls | null = null
const isFullscreen = ref(false)
let fsChangeHandler: (() => void) | null = null

let featureExtractor = createFeatureExtractor({})

let lastW = 0, lastH = 0, lastDpr = 1

function setupThree() {
  if (!canvasRef.value) return
  const canvas = canvasRef.value
  // Force WebGL2
  const gl2 = canvas.getContext('webgl2', { antialias: true, alpha: true }) as WebGL2RenderingContext | null
  if (!gl2) {
    throw new Error('WebGL2 not supported on this browser/device')
  }
  scene = new THREE.Scene()
  camera = new THREE.PerspectiveCamera(55, 1, 0.1, 100)
  camera.position.set(0, 0, 3)
  renderer = new THREE.WebGLRenderer({ canvas, context: gl2 as unknown as WebGLRenderingContext })
  ;(renderer as any).outputColorSpace = (THREE as any).SRGBColorSpace
  const dpr = Math.min(window.devicePixelRatio || 1, 1.5)
  renderer.setPixelRatio(dpr)
  // Mouse controls
  controls = new OrbitControls(camera, canvas)
  controls.enableDamping = true
  controls.dampingFactor = 0.08
  controls.minDistance = 1
  controls.maxDistance = 20
  controls.target.set(0, 0, -6)
  controls.update()
  resize()
  ctx = {
    scene,
    camera,
    renderer,
    canvas,
    dpr,
    size: { w: lastW, h: lastH },
  }
}

function resize() {
  if (!canvasRef.value || !renderer || !camera) return
  const rect = canvasRef.value.getBoundingClientRect()
  const dpr = Math.min(window.devicePixelRatio || 1, 1.5)
  const w = Math.max(1, Math.floor(rect.width))
  const h = Math.max(1, Math.floor(rect.height))
  if (w !== lastW || h !== lastH || dpr !== lastDpr) {
    lastW = w; lastH = h; lastDpr = dpr
    renderer.setPixelRatio(dpr)
    renderer.setSize(w, h, false)
    camera.aspect = w / h
    camera.updateProjectionMatrix()
    if (ctx) {
      ctx.dpr = dpr
      ctx.size.w = w
      ctx.size.h = h
    }
  }
}

let resizeObserver: ResizeObserver | null = null

function start() {
  const loop = () => {
    rafId = requestAnimationFrame(loop)
    resize()
    const f = featureExtractor(props.fft, props.rms ?? -Infinity, props.sampleRate)
    for (const id of props.activeLayerIds) {
      const layer = registry.get(id)
      if (!layer) continue
      layer.update(ctx, f)
    }
    controls?.update()
    renderer.render(scene, camera)
  }
  rafId = requestAnimationFrame(loop)
}

function initLayers(ids: string[]) {
  for (const id of ids) {
    const layer = registry.get(id)
    if (!layer) continue
    if (!('initialized' in (layer as any))) {
      layer.init(ctx)
      ;(layer as any).initialized = true
    }
    layer.setEnabled(true)
  }
}

function setLayerEnabled(ids: string[]) {
  const setEnabled = new Set(ids)
  for (const layer of registry.all()) {
    layer.setEnabled(setEnabled.has(layer.id))
  }
}

watch(() => props.activeLayerIds.slice(), (ids) => {
  if (!ctx) return
  initLayers(ids)
  setLayerEnabled(ids)
}, { deep: true })

// Reset feature extractor state when sourceVersion changes (new source or track)
watch(() => props.sourceVersion, () => {
  featureExtractor = createFeatureExtractor({})
})

onMounted(async () => {
  await nextTick()
  setupThree()
  // Ensure any pre-registered layers are initialized/visibility set
  initLayers(props.activeLayerIds)
  setLayerEnabled(props.activeLayerIds)
  start()
  if (canvasRef.value) {
    resizeObserver = new ResizeObserver(() => resize())
    resizeObserver.observe(canvasRef.value)
  }
  fsChangeHandler = () => {
    isFullscreen.value = !!document.fullscreenElement
    resize()
  }
  document.addEventListener('fullscreenchange', fsChangeHandler)
})

onUnmounted(() => {
  if (rafId) cancelAnimationFrame(rafId)
  if (resizeObserver && canvasRef.value) resizeObserver.unobserve(canvasRef.value)
  for (const layer of registry.all()) layer.dispose()
  renderer?.dispose()
  controls?.dispose()
  controls = null
  if (fsChangeHandler) {
    document.removeEventListener('fullscreenchange', fsChangeHandler)
    fsChangeHandler = null
  }
})

function toggleFullscreen() {
  const root = canvasRef.value?.parentElement
  if (!root) return
  if (!document.fullscreenElement) {
    root.requestFullscreen?.()
  } else {
    document.exitFullscreen?.()
  }
}
</script>

<style scoped>
.host3d { position: relative; width: 100%; height: 100%; }
.host-canvas { width: 100%; height: 540px; display: block; cursor: grab; }
.host3d.fullscreen .host-canvas { height: 100vh; }
.fs-btn {
  position: absolute;
  top: 8px;
  right: 8px;
  z-index: 10;
  background: rgba(0,0,0,0.5);
  color: #fff;
  border: 1px solid rgba(255,255,255,0.3);
  border-radius: 4px;
  padding: 4px 8px;
  cursor: pointer;
}
.fs-btn:hover { background: rgba(0,0,0,0.7); }
</style>


