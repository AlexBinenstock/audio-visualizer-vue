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
  ]
  state: Record<string, any> = {}

  private grid!: THREE.Mesh
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
