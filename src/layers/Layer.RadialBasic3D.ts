// src/layers/Layer.RadialBasic3D.ts
import * as THREE from 'three'
import { Line2 } from 'three/examples/jsm/lines/Line2.js'
import { LineMaterial } from 'three/examples/jsm/lines/LineMaterial.js'
import { LineGeometry } from 'three/examples/jsm/lines/LineGeometry.js'

import { type Layer, type LayerContext, createStateFromControls, registry } from '../engine/layers'
import type { Features } from '../engine/features'

// ---- small helpers (no per-frame allocs) ----
function smooth3(src: Float32Array, out: Float32Array) {
  const n = src.length
  for (let i = 0; i < n; i++) {
    const im1 = (i - 1 + n) % n, ip1 = (i + 1) % n
    out[i] = (src[im1] + 2 * src[i] + src[ip1]) * 0.25
  }
}

class RadialBasic3D implements Layer {
  id = 'radial-basic-3d'
  label = 'Radial (3D Basic)'

  controls: import('../engine/layers').Control[] = [
    { kind:'slider', key:'gain', label:'Gain', min:0.10,max:0.6, step:0.005, default:0.32 },
  ]
  state: Record<string, any> = {}

  // Three objects
  private line: Line2 | null = null
  private geom!: LineGeometry
  private mat!: LineMaterial

  // dynamic buffers (fixed for baseline)
  private N = 180
  private posArray!: Float32Array
  private cosLut!: Float32Array
  private sinLut!: Float32Array
  private prevRadius!: Float32Array

  // temp/reused
  private tmpBins!: Float32Array
  private color = new THREE.Color(0x64ffda)

  init(ctx: LayerContext): void {
    createStateFromControls(this)
    this.buildGeometry(ctx) // creates line, LUTs, buffers
  }

  private buildGeometry(ctx: LayerContext) {
    // dispose old
    if (this.line) {
      this.line.geometry.dispose()
      this.line.material.dispose()
      this.line.removeFromParent()
      this.line = null
    }

    // allocate arrays (N+1 to close the loop by repeating the first vertex)
    this.posArray    = new Float32Array((this.N + 1) * 3)
    this.cosLut      = new Float32Array(this.N)
    this.sinLut      = new Float32Array(this.N)
    this.prevRadius  = new Float32Array(this.N + 1).fill(0.28)

    // bins temp (size adjusted on first update)
    this.tmpBins = new Float32Array(128)

    // angle LUT
    for (let k = 0; k < this.N; k++) {
      const a = (k / this.N) * Math.PI * 2
      this.cosLut[k] = Math.cos(a)
      this.sinLut[k] = Math.sin(a)
    }

    // simplified: no sector arrays

    // geometry + material (Line2 for pixel width)
    this.geom = new LineGeometry()
    this.geom.setPositions(this.posArray as unknown as number[])

    this.mat = new LineMaterial({
      color: 0x64ffda,
      linewidth: (this.state.minWidthPx as number) / Math.max(1, ctx.dpr),
      transparent: true,
      opacity: 0.95,
    })
    this.mat.resolution.set(ctx.size.w, ctx.size.h)

    this.line = new Line2(this.geom, this.mat)
    this.line.computeLineDistances()
    ctx.scene.add(this.line)

    // initial layout
    this.layoutStatic(this.state.radius ?? 0.28)
  }

  private layoutStatic(r: number) {
    for (let k=0; k<this.N; k++) {
      const i3 = k*3
      this.posArray[i3+0] = this.cosLut[k] * r
      this.posArray[i3+1] = this.sinLut[k] * r
      this.posArray[i3+2] = 0
    }
    // close the loop by repeating first vertex at the end
    this.posArray[this.N*3 + 0] = this.posArray[0]
    this.posArray[this.N*3 + 1] = this.posArray[1]
    this.posArray[this.N*3 + 2] = this.posArray[2]
    this.geom.setPositions(this.posArray as unknown as number[])
  }

  // no RNG needed in simplified baseline

  setEnabled(on: boolean): void {
    if (this.line) this.line.visible = on
  }

  update(ctx: LayerContext, f: Features): void {
    // fixed N baseline; no dynamic rebuild
    if (!this.line) return

    // keep resolution in sync for LineMaterial
    this.mat.resolution.set(ctx.size.w, ctx.size.h)

    const baseRadius = 0.28
    const gain = this.state.gain as number

    // primary bins (per-bin AGC normalized)
    const bins = (f as any).bins ?? f.binsLog
    if (this.tmpBins.length !== bins.length) this.tmpBins = new Float32Array(bins.length)
    smooth3(bins, this.tmpBins)
    // Simple sample mapping (no bucket averaging)
    const numBins = this.tmpBins.length
    const step = numBins / this.N

    // simplified: no impulses/waves/micro
    const dt = Math.min(100, Math.max(1, (f.dt || 16.7)))
    // per-vertex attack/decay (faster response)
    const aUp = Math.exp(-dt / 35)
    const aDn = Math.exp(-dt / 150)

    // build radius per vertex from: bucket[k] + sector impulses + mid wave + hi micro
    for (let k=0; k<this.N; k++) {
      // angle = (k / this.N) * Math.PI * 2 // not needed in simplified path

      // sample/interpolate bin magnitude
      const p = (k + 0.5) * step
      const i0 = Math.floor(p) % numBins
      const i1 = (i0 + 1) % numBins
      const tt = p - Math.floor(p)
      const mag = this.tmpBins[i0] * (1 - tt) + this.tmpBins[i1] * tt
      const rTarget = baseRadius + gain * mag

      const rPrev = this.prevRadius[k]
      const r = rTarget > rPrev ? rPrev * aUp + rTarget * (1 - aUp)
                                : rPrev * aDn + rTarget * (1 - aDn)
      this.prevRadius[k] = r

      const i3 = k*3
      this.posArray[i3+0] = this.cosLut[k] * r
      this.posArray[i3+1] = this.sinLut[k] * r
      this.posArray[i3+2] = 0
    }
    // repeat first vertex at the end to close line smoothly
    this.posArray[this.N*3 + 0] = this.posArray[0]
    this.posArray[this.N*3 + 1] = this.posArray[1]
    this.posArray[this.N*3 + 2] = this.posArray[2]

    // push positions (LineGeometry copies internally; same array instance reused)
    this.geom.setPositions(this.posArray as unknown as number[])
    this.line.computeLineDistances()

    this.mat.color.set(this.color)

    this.mat.linewidth = 2 / Math.max(1, ctx.dpr)
    this.mat.needsUpdate = true
  }

  dispose(): void {
    if (this.line) {
      this.line.geometry.dispose()
      this.line.material.dispose()
      this.line.removeFromParent()
      this.line = null
    }
  }
}

registry.register(new RadialBasic3D())
