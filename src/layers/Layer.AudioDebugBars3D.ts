import * as THREE from 'three'
import { type Layer, type LayerContext, createStateFromControls, registry } from '../engine/layers'
import type { Features } from '../engine/features'

// Layout/visual constants (named to avoid magic numbers)
const MAX_BIN_BARS = 256
const BINS_REGION_WIDTH = 2.8
const BASELINE_Y = -0.9
const RMS_BAR_X = 1.35
const BANDS_BASE_X = -1.35
const BAND_X_SPACING = 0.22
const RMS_BAR_WIDTH = 0.15
const BAND_BAR_WIDTH = 0.15
const Z_OFFSET = 0.01

// Value-to-height scales and minimums
const MIN_BAR_HEIGHT = 0.001
const BINS_VALUE_TO_HEIGHT = 1.4
const RMS_VALUE_TO_HEIGHT = 1.6
const BANDS_VALUE_TO_HEIGHT = 1.6

class AudioDebugBars3D implements Layer {
  id = 'audio-debug-bars-3d'
  label = 'Audio Debug Bars'
  controls: import('../engine/layers').Control[] = [
    { kind: 'slider', key: 'barScaleY', label: 'Bar Scale Y', min: 0.2, max: 2.5, step: 0.05, default: 1.0 },
    { kind: 'slider', key: 'barGap', label: 'Bar Gap', min: 0.0, max: 0.02, step: 0.001, default: 0.005 },
    { kind: 'toggle', key: 'showRaw', label: 'Show Raw Bins', default: false },
  ]
  state: Record<string, any> = {}

  private binsMesh: THREE.InstancedMesh | null = null
  private rmsMesh: THREE.Mesh | null = null
  private lowMesh: THREE.Mesh | null = null
  private midMesh: THREE.Mesh | null = null
  private highMesh: THREE.Mesh | null = null

  private capacity = MAX_BIN_BARS // max bars supported without rebuild
  private sharedGeom: THREE.PlaneGeometry | null = new THREE.PlaneGeometry(1, 1)
  private geom = this.sharedGeom!
  private matBins = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.9, vertexColors: true })
  private matRms = new THREE.MeshBasicMaterial({ color: 0x64ffda, transparent: true, opacity: 0.95, depthWrite: false, depthTest: false })
  private matLow = new THREE.MeshBasicMaterial({ color: 0x29b6f6, transparent: true, opacity: 0.9, depthWrite: false, depthTest: false })
  private matMid = new THREE.MeshBasicMaterial({ color: 0xffc107, transparent: true, opacity: 0.9, depthWrite: false, depthTest: false })
  private matHigh = new THREE.MeshBasicMaterial({ color: 0xff1744, transparent: true, opacity: 0.9, depthWrite: false, depthTest: false })
  // Track shared materials for potential future management
  // (lint note: referenced via direct fields in dispose)
  // private sharedMats: THREE.Material[] = [this.matBins, this.matRms, this.matLow, this.matMid, this.matHigh]

  init(ctx: LayerContext): void {
    createStateFromControls(this)
    // Bins as instanced planes laid out along X
    const bins = new THREE.InstancedMesh(this.geom, this.matBins, this.capacity)
    bins.instanceMatrix.setUsage(THREE.DynamicDrawUsage)
    bins.frustumCulled = false
    ctx.scene.add(bins)
    this.binsMesh = bins
    ;(this.binsMesh as any)._lastColorCount = -1

    // Single bars for RMS and bands
    this.rmsMesh = new THREE.Mesh(this.geom, this.matRms)
    this.lowMesh = new THREE.Mesh(this.geom, this.matLow)
    this.midMesh = new THREE.Mesh(this.geom, this.matMid)
    this.highMesh = new THREE.Mesh(this.geom, this.matHigh)
    this.lowMesh.renderOrder = 1
    this.midMesh.renderOrder = 2
    this.highMesh.renderOrder = 3
    this.rmsMesh.renderOrder = 4
    this.rmsMesh.matrixAutoUpdate = true
    this.lowMesh.matrixAutoUpdate = true
    this.midMesh.matrixAutoUpdate = true
    this.highMesh.matrixAutoUpdate = true
    ctx.scene.add(this.rmsMesh, this.lowMesh, this.midMesh, this.highMesh)
  }

  update(_ctx: LayerContext, f: Features): void {
    if (!this.binsMesh || !this.rmsMesh || !this.lowMesh || !this.midMesh || !this.highMesh) return

    // Use RAW bins for debug (no AC-coupling or knee)
    const useRaw = !!this.state.showRaw
    const bins = useRaw ? ((f as any).binsLogRaw ?? f.binsLog) : ((f as any).bins ?? f.binsLog)
    const n = bins.length
    // layout params
    const barScaleY = (this.state.barScaleY as number) || 1.0
    const barGap = (this.state.barGap as number) || 0.005
    const width = BINS_REGION_WIDTH
    const baseY = BASELINE_Y

    // spacing and width per bar
    const count = Math.min(n, this.capacity)
    ;(this.binsMesh as any).count = count
    const barWidth = width / Math.max(1, count)
    const actualWidth = Math.max(0, barWidth - barGap)

    const m = new THREE.Matrix4()
    const q = new THREE.Quaternion()
    const pos = new THREE.Vector3()
    const scl = new THREE.Vector3()
    for (let i = 0; i < count; i++) {
      const v = bins[i]
      const h = Math.max(MIN_BAR_HEIGHT, v * BINS_VALUE_TO_HEIGHT * barScaleY)
      const x0 = -width / 2 + (i + 0.5) * barWidth
      pos.set(x0, baseY + h / 2, 0)
      scl.set(actualWidth, h, 1)
      m.compose(pos, q, scl)
      this.binsMesh!.setMatrixAt(i, m)
    }
    this.binsMesh.instanceMatrix.needsUpdate = true
    if (this.binsMesh.instanceColor) (this.binsMesh.instanceColor as any).needsUpdate = true

    // RMS bar (right side)
    const rmsH = Math.max(MIN_BAR_HEIGHT, f.rmsPeak01 * RMS_VALUE_TO_HEIGHT * barScaleY)
    this.rmsMesh.position.set(RMS_BAR_X, baseY + rmsH / 2, Z_OFFSET)
    this.rmsMesh.scale.set(RMS_BAR_WIDTH, rmsH, 1)
    this.rmsMesh.matrixAutoUpdate = true
    ;(this.matRms as THREE.MeshBasicMaterial).color.setHex(f.onset ? 0x00ffc3 : 0x64ffda)

    // Bands (left side stack)
    const bW = BAND_BAR_WIDTH
    const xBands = BANDS_BASE_X
    // Use RAW band summaries for debug visibility
    const br = (f as any).bandsRaw ?? f.bands
    const bandsSrc = useRaw ? br : f.bands
    const lowH = Math.max(MIN_BAR_HEIGHT, bandsSrc.low * BANDS_VALUE_TO_HEIGHT * barScaleY)
    const midH = Math.max(MIN_BAR_HEIGHT, bandsSrc.mid * BANDS_VALUE_TO_HEIGHT * barScaleY)
    const highH = Math.max(MIN_BAR_HEIGHT, bandsSrc.high * BANDS_VALUE_TO_HEIGHT * barScaleY)

    this.lowMesh.position.set(xBands, baseY + lowH / 2, Z_OFFSET)
    this.lowMesh.scale.set(bW, lowH, 1)
    this.lowMesh.matrixAutoUpdate = true

    this.midMesh.position.set(xBands - BAND_X_SPACING, baseY + midH / 2, Z_OFFSET)
    this.midMesh.scale.set(bW, midH, 1)
    this.midMesh.matrixAutoUpdate = true

    this.highMesh.position.set(xBands - 2 * BAND_X_SPACING, baseY + highH / 2, Z_OFFSET)
    this.highMesh.scale.set(bW, highH, 1)
    this.highMesh.matrixAutoUpdate = true
  }

  setEnabled(on: boolean): void {
    if (this.binsMesh) this.binsMesh.visible = on
    if (this.rmsMesh) this.rmsMesh.visible = on
    if (this.lowMesh) this.lowMesh.visible = on
    if (this.midMesh) this.midMesh.visible = on
    if (this.highMesh) this.highMesh.visible = on
  }

  dispose(): void {
    if (this.binsMesh) { this.binsMesh.removeFromParent(); this.binsMesh.dispose(); this.binsMesh = null }
    for (const mesh of [this.rmsMesh, this.lowMesh, this.midMesh, this.highMesh]) {
      if (mesh) { mesh.removeFromParent() }
    }
    this.rmsMesh = this.lowMesh = this.midMesh = this.highMesh = null
    if (this.sharedGeom) { this.sharedGeom.dispose(); this.sharedGeom = null }
    for (const mat of [this.matBins, this.matRms, this.matLow, this.matMid, this.matHigh]) (mat as THREE.Material).dispose()
  }
}

registry.register(new AudioDebugBars3D())


