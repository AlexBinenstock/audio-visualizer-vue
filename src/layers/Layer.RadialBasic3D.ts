import * as THREE from 'three'
import { type Layer, type LayerContext, createStateFromControls, registry } from '../engine/layers'
import type { Features } from '../engine/features'

const VERTS = 721

class RadialBasic3D implements Layer {
  id = 'radial-basic-3d'
  label = 'Radial (3D Basic)'
  controls = [
    { kind: 'slider', key: 'radius', label: 'Radius', min: 0.15, max: 0.6, step: 0.005, default: 0.28 },
    { kind: 'slider', key: 'gain', label: 'Gain', min: 0.1, max: 0.6, step: 0.005, default: 0.32 },
    { kind: 'slider', key: 'thickness', label: 'Thickness', min: 1, max: 6, step: 1, default: 2 },
    { kind: 'toggle', key: 'onsetPulse', label: 'Onset Pulse', default: true },
  ] as const
  state: Record<string, any> = {}

  private line: THREE.Line | null = null
  private pos: Float32Array | null = null
  private onsetScale = 0

  init(ctx: LayerContext): void {
    createStateFromControls(this)
    const positions = new Float32Array(VERTS * 3)
    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    const mat = new THREE.LineBasicMaterial({ color: 0x64ffda, transparent: true, opacity: 0.9 })
    const line = new THREE.Line(geo, mat)
    ctx.scene.add(line)
    this.line = line
    this.pos = positions
    this.layoutCircle()
  }

  private layoutCircle() {
    if (!this.pos) return
    const radius = this.state.radius ?? 0.28
    for (let k = 0; k < VERTS; k++) {
      const a = (k / (VERTS - 1)) * Math.PI * 2
      const x = Math.cos(a) * radius
      const y = Math.sin(a) * radius
      const i = k * 3
      this.pos[i] = x
      this.pos[i + 1] = y
      this.pos[i + 2] = 0
    }
    if (this.line) (this.line.geometry.getAttribute('position') as THREE.BufferAttribute).needsUpdate = true
  }

  update(ctx: LayerContext, f: Features): void {
    if (!this.line || !this.pos) return
    const radius = this.state.radius as number
    const gain = this.state.gain as number
    const onsetPulse = !!this.state.onsetPulse

    if (f.onset && onsetPulse) this.onsetScale = Math.min(0.12, this.onsetScale + 0.06)
    this.onsetScale *= 0.85

    const bins = f.binsLog
    const n = bins.length
    for (let k = 0; k < VERTS; k++) {
      const idx = Math.floor((k / VERTS) * n) % n
      const v = bins[idx]
      const r = (radius + this.onsetScale) + gain * v
      const a = (k / (VERTS - 1)) * Math.PI * 2
      const x = Math.cos(a) * r
      const y = Math.sin(a) * r
      const i = k * 3
      this.pos[i] = x
      this.pos[i + 1] = y
      // z left as 0
    }
    ;(this.line.geometry.getAttribute('position') as THREE.BufferAttribute).needsUpdate = true

    const color = new THREE.Color().setHSL(0.48 + 0.12 * f.bands.high, 0.8, 0.5 + 0.2 * f.energy)
    const mat = this.line.material as THREE.LineBasicMaterial
    mat.color = color
    mat.opacity = 0.6 + 0.4 * f.energy
  }

  setEnabled(on: boolean): void {
    if (this.line) this.line.visible = on
  }

  dispose(): void {
    if (this.line) {
      this.line.geometry.dispose()
      ;(this.line.material as THREE.Material).dispose()
      this.line.removeFromParent()
      this.line = null
    }
    this.pos = null
  }
}

registry.register(new RadialBasic3D())


