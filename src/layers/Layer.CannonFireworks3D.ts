import * as THREE from 'three'
import { type Layer, type LayerContext, createStateFromControls, registry } from '../engine/layers'
import type { Features } from '../engine/features'

type Attrs = {
  a_birth: THREE.BufferAttribute
  a_life: THREE.BufferAttribute
  a_pos0: THREE.BufferAttribute
  a_vel0: THREE.BufferAttribute
  a_hue: THREE.BufferAttribute
  a_size: THREE.BufferAttribute
}

class CannonFireworks3D implements Layer {
  id = 'cannon-fireworks-3d'
  label = 'Cannon Fireworks'
  controls: import('../engine/layers').Control[] = [
    { kind: 'slider', key: 'cannonCount', label: 'Cannons', min: 6, max: 24, step: 1, default: 12 },
    { kind: 'slider', key: 'radius', label: 'Radius', min: 1.5, max: 5.0, step: 0.1, default: 3.2 },
    { kind: 'slider', key: 'tiltDeg', label: 'Tilt', min: 5, max: 30, step: 1, default: 18 },
    { kind: 'slider', key: 'baseRate', label: 'Base Rate', min: 0, max: 12, step: 0.1, default: 5 },
    { kind: 'slider', key: 'bassRateGain', label: 'Bass Rate Gain', min: 0, max: 24, step: 0.1, default: 12 },
    { kind: 'slider', key: 'spread', label: 'Spread', min: 0.05, max: 0.4, step: 0.01, default: 0.18 },
    { kind: 'slider', key: 'gravity', label: 'Gravity', min: 0.5, max: 6.0, step: 0.1, default: 3.5 },
    { kind: 'slider', key: 'particleLifeMs', label: 'Life (ms)', min: 400, max: 2200, step: 10, default: 1200 },
    { kind: 'slider', key: 'particleSizePx', label: 'Size (px)', min: 2, max: 12, step: 1, default: 5 },
    { kind: 'slider', key: 'maxParticles', label: 'Max Particles', min: 2000, max: 20000, step: 100, default: 16000 },
  ]
  state: Record<string, any> = {}

  private points: THREE.Points | null = null
  private attrs: Attrs | null = null
  private birthTimes!: Float32Array
  private lifeTimes!: Float32Array
  private pos0!: Float32Array
  private vel0!: Float32Array
  private hue!: Float32Array
  private size!: Float32Array
  private writeIndex = 0
  private emitCarry = 0
  private lastCannonIndex = 0

  private lastT = performance.now()

  init(ctx: LayerContext): void {
    createStateFromControls(this)
    const N = this.state.maxParticles as number
    this.birthTimes = new Float32Array(N)
    this.lifeTimes = new Float32Array(N)
    this.pos0 = new Float32Array(N * 3)
    this.vel0 = new Float32Array(N * 3)
    this.hue = new Float32Array(N)
    this.size = new Float32Array(N)

    const geo = new THREE.BufferGeometry()
    // Provide a dummy position attribute so Three.js knows the vertex count
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(N * 3), 3))
    const a_birth = new THREE.BufferAttribute(this.birthTimes, 1)
    const a_life = new THREE.BufferAttribute(this.lifeTimes, 1)
    const a_pos0 = new THREE.BufferAttribute(this.pos0, 3)
    const a_vel0 = new THREE.BufferAttribute(this.vel0, 3)
    const a_hue = new THREE.BufferAttribute(this.hue, 1)
    const a_size = new THREE.BufferAttribute(this.size, 1)
    geo.setAttribute('a_birth', a_birth)
    geo.setAttribute('a_life', a_life)
    geo.setAttribute('a_pos0', a_pos0)
    geo.setAttribute('a_vel0', a_vel0)
    geo.setAttribute('a_hue', a_hue)
    geo.setAttribute('a_size', a_size)

    const mat = new THREE.ShaderMaterial({
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      transparent: true,
      uniforms: {
        u_time: { value: 0 },
        u_gravity: { value: this.state.gravity as number },
      },
      vertexShader: `
        uniform float u_time;
        uniform float u_gravity;
        attribute float a_birth; // ms
        attribute float a_life;  // ms
        attribute vec3 a_pos0;
        attribute vec3 a_vel0;
        attribute float a_hue;
        attribute float a_size;
        varying float v_life;
        varying float v_hue;
        void main(){
          float t = (u_time - a_birth) / a_life;
          t = clamp(t, 0.0, 1.0);
          v_life = 1.0 - t;
          v_hue = a_hue;
          vec3 pos = a_pos0 + a_vel0 * (t * a_life * 0.001);
          // gravity acts along -Z to match XY-oriented ring
          pos.z += -0.5 * u_gravity * (t * a_life * 0.001) * (t * a_life * 0.001);
          vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
          gl_PointSize = a_size * (300.0 / -mvPosition.z);
          gl_Position = projectionMatrix * mvPosition;
        }
      `,
      fragmentShader: `
        precision mediump float;
        varying float v_life;
        varying float v_hue;
        // simple HSL to RGB (approx)
        vec3 hsl2rgb(float h, float s, float l){
          float c = (1.0 - abs(2.0*l - 1.0)) * s;
          float x = c * (1.0 - abs(mod(h*6.0, 2.0) - 1.0));
          float m = l - 0.5*c;
          vec3 rgb;
          if(h < 1.0/6.0) rgb = vec3(c,x,0.0);
          else if(h < 2.0/6.0) rgb = vec3(x,c,0.0);
          else if(h < 3.0/6.0) rgb = vec3(0.0,c,x);
          else if(h < 4.0/6.0) rgb = vec3(0.0,x,c);
          else if(h < 5.0/6.0) rgb = vec3(x,0.0,c);
          else rgb = vec3(c,0.0,x);
          return rgb + m;
        }
        void main(){
          float alpha = smoothstep(0.0, 0.1, v_life) * smoothstep(0.0, 1.0, v_life);
          vec3 col = hsl2rgb(v_hue, 0.8, mix(0.4, 0.9, v_life));
          gl_FragColor = vec4(col, alpha);
        }
      `,
    })

    const points = new THREE.Points(geo, mat)
    ctx.scene.add(points)
    this.points = points
    this.attrs = { a_birth, a_life, a_pos0, a_vel0, a_hue, a_size }
  }

  update(_ctx: LayerContext, f: Features): void {
    if (!this.points || !this.attrs) return
    const now = performance.now()
    const dt = Math.max(1, now - this.lastT)
    this.lastT = now

    const N = this.state.maxParticles as number
    const cannons = this.state.cannonCount as number
    const R = this.state.radius as number
    const tilt = (this.state.tiltDeg as number) * Math.PI / 180
    const spread = this.state.spread as number
    const lifeMs = this.state.particleLifeMs as number
    const sizePx = this.state.particleSizePx as number
    const gravity = this.state.gravity as number

    ;(this.points.material as THREE.ShaderMaterial).uniforms.u_time.value = now
    ;(this.points.material as THREE.ShaderMaterial).uniforms.u_gravity.value = gravity

    // Compute band energies from normalized bins (fallback to processed if absent)
    const bins = (f as any).bins ?? f.binsLog
    const nBins = bins.length
    let lowAvg = f.bands.low, midAvg = f.bands.mid, highAvg = f.bands.high
    if (nBins > 0) {
      const fMin = 20, fMax = 8000
      const mapHzToIdx = (hz: number) => {
        const t = (Math.log(hz) - Math.log(fMin)) / (Math.log(fMax) - Math.log(fMin))
        const idx = Math.round(t * (nBins - 1))
        return Math.max(0, Math.min(nBins - 1, idx))
      }
      const avgRange = (hz0: number, hz1: number) => {
        const i0 = mapHzToIdx(hz0)
        const i1 = mapHzToIdx(hz1)
        const a = Math.min(i0, i1), b = Math.max(i0, i1)
        let s = 0, c = 0
        for (let i = a; i <= b; i++) { s += bins[i]; c++ }
        return c ? s / c : 0
      }
      lowAvg = avgRange(20, 160)
      midAvg = avgRange(160, 2000)
      highAvg = avgRange(2000, 8000)
    }

    // Audio-driven emission only: threshold and curve to avoid constant trickle
    const low = Math.max(0, lowAvg - 0.04)
    const audioDrive = Math.pow(low, 2) // emphasize stronger lows
    const ratePerCannon = audioDrive * (this.state.bassRateGain as number) // particles/sec per cannon
    const dtSec = dt / 1000

    // Accumulate fractional emissions across frames for stability
    const totalToEmit = cannons * ratePerCannon * dtSec + this.emitCarry
    let numToEmit = Math.floor(totalToEmit)
    this.emitCarry = totalToEmit - numToEmit

    while (numToEmit-- > 0) {
      const c = this.lastCannonIndex % cannons
      this.lastCannonIndex = (this.lastCannonIndex + 1) % cannons
      const baseAngle = (c / cannons) * Math.PI * 2
      // Orient cannons around XY ring (z = 0), shooting slightly out of plane (+Z) by tilt
      const dirX = Math.cos(baseAngle) * Math.cos(tilt)
      const dirY = Math.sin(baseAngle) * Math.cos(tilt)
      const dirZ = Math.sin(tilt)

      // Write one particle
      const i = this.writeIndex % N
      this.writeIndex = (this.writeIndex + 1) % N
      const tBirth = now
      const hue = (0.03 * c + 0.6 * highAvg + 0.2 * midAvg) % 1
      const speed = 1.8 + 2.2 * f.energy
      const spreadAngle = (Math.random() - 0.5) * spread
      const cs = Math.cos(spreadAngle)
      const vx = dirX * speed * cs
      const vy = dirY * speed * cs
      const vz = dirZ * speed + (Math.random() * 0.3)
      const px = Math.cos(baseAngle) * R
      const py = Math.sin(baseAngle) * R
      const pz = 0

      this.birthTimes[i] = tBirth
      this.lifeTimes[i] = lifeMs
      const pi = i * 3
      this.pos0[pi] = px; this.pos0[pi + 1] = py; this.pos0[pi + 2] = pz
      this.vel0[pi] = vx; this.vel0[pi + 1] = vy; this.vel0[pi + 2] = vz
      this.hue[i] = hue
      this.size[i] = sizePx * Math.max(0.05, 0.3 * highAvg)
    }

    // Mark full ranges as updated (we could track slices per frame, but this stays O(1) allocations)
    this.attrs.a_birth.needsUpdate = true
    this.attrs.a_life.needsUpdate = true
    this.attrs.a_pos0.needsUpdate = true
    this.attrs.a_vel0.needsUpdate = true
    this.attrs.a_hue.needsUpdate = true
    this.attrs.a_size.needsUpdate = true
  }

  setEnabled(on: boolean): void {
    if (this.points) this.points.visible = on
  }

  dispose(): void {
    if (this.points) {
      this.points.geometry.dispose()
      ;(this.points.material as THREE.Material).dispose()
      this.points.removeFromParent()
      this.points = null
    }
    this.attrs = null
  }
}

registry.register(new CannonFireworks3D())


