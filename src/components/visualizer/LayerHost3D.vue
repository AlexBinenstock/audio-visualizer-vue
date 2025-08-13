<template>
  <div class="host3d">
    <canvas ref="canvasRef" class="host-canvas"></canvas>
  </div>
</template>

<script setup lang="ts">
import { onMounted, onUnmounted, ref, watch, nextTick } from 'vue'
import * as THREE from 'three'
import { createFeatureExtractor } from '../../engine/features'
import { registry, type Layer, type LayerContext } from '../../engine/layers'
import '../../layers/Layer.RadialBasic3D'
import '../../layers/Layer.CannonFireworks3D'

interface Props {
  fft: Float32Array
  rms?: number
  sampleRate: number
  activeLayerIds: string[]
}
const props = defineProps<Props>()

const canvasRef = ref<HTMLCanvasElement>()
let scene: THREE.Scene
let camera: THREE.PerspectiveCamera
let renderer: THREE.WebGLRenderer
let ctx: LayerContext
let rafId = 0

const featureExtractor = createFeatureExtractor({})

let lastW = 0, lastH = 0, lastDpr = 1

function setupThree() {
  if (!canvasRef.value) return
  const canvas = canvasRef.value
  scene = new THREE.Scene()
  camera = new THREE.PerspectiveCamera(55, 1, 0.1, 100)
  camera.position.set(0, 0, 3)
  renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true })
  const dpr = Math.min(window.devicePixelRatio || 1, 1.5)
  renderer.setPixelRatio(dpr)
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
    const f = featureExtractor(props.fft, props.rms ?? 0, props.sampleRate)
    for (const id of props.activeLayerIds) {
      const layer = registry.get(id)
      if (!layer) continue
      layer.update(ctx, f)
    }
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
})

onUnmounted(() => {
  if (rafId) cancelAnimationFrame(rafId)
  if (resizeObserver && canvasRef.value) resizeObserver.unobserve(canvasRef.value)
  for (const layer of registry.all()) layer.dispose()
  renderer?.dispose()
})
</script>

<style scoped>
.host3d { width: 100%; height: 100%; }
.host-canvas { width: 100%; height: 540px; display: block; }
</style>


