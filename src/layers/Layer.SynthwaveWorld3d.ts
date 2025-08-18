// src/layers/Layer.SynthwaveWorld3D.ts
import * as THREE from 'three'
import { registry, type Layer, type LayerContext, createStateFromControls } from '../engine/layers'
import type { Features } from '../engine/features'

class SynthwaveWorld3D implements Layer {
  id = 'synthwave-world-3d'
  label = 'Synthwave Grid'

  controls: import('../engine/layers').Control[] = [
    { kind:'slider', key:'gridStep',   label:'Grid Step (world units)', min:0.20, max:4.0,  step:0.01,  default:1.60 },
    { kind:'slider', key:'lineWidth',  label:'Line Width (fraction)',   min:0.02, max:0.30, step:0.005, default:0.12 },
    { kind:'slider', key:'speed',      label:'Base Speed',  min:0.3,  max:6.0,  step:0.1,   default:1.8  },
    { kind:'slider', key:'fadeDepth',  label:'Depth Fade',  min:0.004,max:0.03, step:0.001, default:0.010 },
    { kind:'slider', key:'hue',        label:'Neon Hue',    min:0.70, max:0.98, step:0.001, default:0.86  },
    { kind:'toggle', key:'tiltCamera', label:'Tilt Camera', default:true },
    { kind:'slider', key:'emissive', label:'Emissive', min:0.2, max:3.0, step:0.05, default:1.0 },
    { kind:'slider', key:'poleSpacing', label:'Pole Spacing (z)', min:2,  max:12, step:0.5, default:6 },
    { kind:'slider', key:'poleHeight',  label:'Pole Height',      min:0.4,max:3.0, step:0.05, default:1.2 },
    { kind:'slider', key:'poleXOffset', label:'Pole X Offset',    min:3.0,max:20,  step:0.1,  default:6.5 },
    { kind:'slider', key:'poleGlow',    label:'Pole Glow',        min:0.2,max:3.0, step:0.05, default:1.4 },

  ]
  state: Record<string, any> = {}

  private grid!: THREE.Mesh
  private poles!: THREE.InstancedMesh
  private poleCount = 120 // enough to cover view; cheap with instancing
  private poleMat!: THREE.MeshBasicMaterial
  private poleGeom!: THREE.CylinderGeometry

  private u!: {
    uScroll:    { value: number }
    uStep:      { value: number }
    uWidth:     { value: number }
    uFadeDepth: { value: number }
    uHue:       { value: number }
    uEmissive:  { value: number }
  }

  private scroll = 0

  init(ctx: LayerContext): void {
    createStateFromControls(this)

    // Wide, deep plane; grid computed in world units (XZ), not UV
    const geo = new THREE.PlaneGeometry(160, 120, 1, 1)
    geo.rotateX(-Math.PI / 2)
    geo.translate(0, -0.65, -8.0)

    this.u = {
      uScroll:    { value: 0 },
      uStep:      { value: this.state.gridStep },
      uWidth:     { value: this.state.lineWidth },
      uFadeDepth: { value: this.state.fadeDepth },
      uHue:       { value: this.state.hue },
      uEmissive:  { value: this.state.emissive },
    }

    const mat = new THREE.ShaderMaterial({
      uniforms: this.u,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
      // WebGL2 / GLSL3
      glslVersion: THREE.GLSL3,
      vertexShader: /* glsl */`
        out vec2 vXZ;
        out float vViewZ;
        void main() {
          vXZ = position.xz;
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          vViewZ = -mv.z;
          gl_Position = projectionMatrix * mv;
        }
      `,
      fragmentShader: /* glsl */`
        precision highp float;
        in vec2 vXZ;
        in float vViewZ;
        out vec4 outColor;

        uniform float uScroll, uStep, uWidth, uFadeDepth, uHue, uEmissive;

        // Simple HSL->RGB
        vec3 hsl2rgb(vec3 c){
          vec3 p = abs(fract(c.xxx + vec3(0., 2./3., 1./3.)) * 6. - 3.);
          vec3 rgb = c.z + c.y * (clamp(p - 1., 0., 1.) - 0.5) * (1. - abs(2.*c.z - 1.));
          return rgb;
        }

        // Neon grid: distance to nearest grid line; AA via fwidth (available in WebGL2)
        float gridMask(vec2 uv, float stepSize, float lineWidth){
          vec2 g = abs(fract(uv / stepSize) - 0.5);
          float d = min(g.x, g.y);
          float aa = max(0.75, fwidth(d) * 1.25);
          return 1.0 - smoothstep(lineWidth*0.5 - aa, lineWidth*0.5 + aa, d);
        }

        void main(){
          // world-space grid in XZ; scroll along +Z
          vec2 uv = vXZ;
          uv.y += uScroll;

          float lines = gridMask(uv, uStep, uWidth);

          // depth fade (closer = brighter), emissive lift
          float depth = exp(-uFadeDepth * vViewZ);
          float luma  = lines * (uEmissive * depth);

          vec3 color = hsl2rgb(vec3(uHue, 0.95, 0.60)) * luma;
          outColor = vec4(color, luma);
        }
      `,
    })

    this.grid = new THREE.Mesh(geo, mat)
    this.grid.renderOrder = 0
    ctx.scene.add(this.grid)

    // A pleasant default “driver’s view”
    if (this.state.tiltCamera) {
      ctx.camera.position.set(0, 1.1, 3.6)
      ctx.camera.lookAt(0, -0.35, -8.0)
    }

    // --- Roadside poles (instanced) ---
    const poleRadius = 0.05
    const poleHeight = (this.state.poleHeight as number) ?? 1.2
    this.poleGeom = new THREE.CylinderGeometry(poleRadius, poleRadius, poleHeight, 8, 1, true)
    this.poleGeom.translate(0, poleHeight * 0.5, 0) // sit on ground
    this.poleMat = new THREE.MeshBasicMaterial({
      color: new THREE.Color().setHSL((this.state.hue as number) ?? 0.86, 1.0, 0.55),
      transparent: true,
      opacity: 0.95
    })

    this.poles = new THREE.InstancedMesh(this.poleGeom, this.poleMat, this.poleCount)
    this.poles.instanceMatrix.setUsage(THREE.DynamicDrawUsage)
    this.poles.frustumCulled = false
    ctx.scene.add(this.poles)

  }

  setEnabled(on: boolean): void {
    if (this.grid) this.grid.visible = on
  }

  update(_ctx: LayerContext, f: Features): void {
    if (!this.grid) return

    const dt = f.dt
    const baseSpeed  = (this.state.speed      as number) ?? 1.8
    const step       = (this.state.gridStep   as number) ?? 0.60
    const width      = (this.state.lineWidth  as number) ?? 1.10
    const fadeDepth  = (this.state.fadeDepth  as number) ?? 0.010
    const hue        = (this.state.hue        as number) ?? 0.86

    // keep motion when quiet; add with adaptive energy
    const speed = baseSpeed * (0.7 + 0.8 * f.energyPeak01)
    this.scroll = (this.scroll - (dt * 0.001) * speed) % 1000
    if (this.scroll < 0) this.scroll += 1000

    // push uniforms
    this.u.uScroll.value    = this.scroll
    this.u.uStep.value      = step
    this.u.uWidth.value     = width
    this.u.uFadeDepth.value = fadeDepth
    this.u.uHue.value       = hue
    this.u.uEmissive.value  = (this.state.emissive as number) ?? 1.0

    // --- Update poles (wrap on scroll) ---
    const spacing = (this.state.poleSpacing as number) ?? 6
    const xOff    = (this.state.poleXOffset as number) ?? 6.5
    const h       = (this.state.poleHeight as number) ?? 1.2
    const glow    = (this.state.poleGlow   as number) ?? 1.4

    // color can follow grid hue for cohesion (constant brightness)
    this.poleMat.color.setHSL(hue, 1.0, 0.55)
    this.poleMat.opacity = Math.min(1.5, glow) * 0.95

    // compute z range to fill
    // our plane center is around z=-8 .. looking toward -Z; we want poles from ~-2 in front to ~-120 back
    const zFront = -2
    const zBack  = -120

    // align the first pole to scroll phase so movement matches the grid
    // place N poles on both sides, interleaving left/right
    const tmp = new THREE.Matrix4()
    const quat = new THREE.Quaternion()
    const scl = new THREE.Vector3(1,1,1)
    const count = this.poleCount
    const laneCount = 2

    for (let i = 0; i < count; i++) {
      // index along z
      const stepIndex = Math.floor(i / laneCount)
      // wrap so we keep them inside [zBack, zFront]
      const zRaw = zFront - (stepIndex * spacing)
      // tie to scroll so they flow (reversed to match grid direction)
      let z = zRaw - (this.scroll % spacing)
      // wrap if we went beyond zBack
      while (z < zBack) z += ((Math.ceil((zBack - z) / spacing)) * spacing)

      const isLeft = (i % 2) === 0
      const x = (isLeft ? -xOff : xOff)
      const y = 0 // on ground plane at y ~= -0.65; our pole geometry already sits on y=0, scene plane is translated

      const pos = new THREE.Vector3(x, -0.65, z)  // match plane y translate
      tmp.compose(pos, quat, scl)
      this.poles.setMatrixAt(i, tmp)
    }
    this.poles.instanceMatrix.needsUpdate = true

  }

  dispose(): void {
    if (this.grid) {
      this.grid.geometry.dispose()
      ;(this.grid.material as THREE.Material).dispose()
      this.grid.removeFromParent()
    }
  }
}

registry.register(new SynthwaveWorld3D())
