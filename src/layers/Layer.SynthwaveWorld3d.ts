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
    { kind:'slider', key:'speed',      label:'Base Speed',  min:1,  max:300.0, step:1,   default:80.0  },
    { kind:'slider', key:'roadWidth',  label:'Road Width (world units)',  min:0,   max:80,   step:0.5,   default:20 },
    { kind:'slider', key:'roadFeather',label:'Road Feather (world units)',min:0,   max:40,   step:0.5,   default:8 },
    { kind:'slider', key:'fadeDepth',  label:'Depth Fade',  min:0.004,max:0.03, step:0.001, default:0.010 },
    { kind:'slider', key:'hue',        label:'Neon Hue',    min:0.70, max:0.98, step:0.001, default:0.86  },
    { kind:'toggle', key:'tiltCamera', label:'Tilt Camera', default:true },
    { kind:'slider', key:'lineBrightness', label:'Line Brightness', min:0.1, max:4.0, step:0.05, default:1.25 },
    { kind:'slider', key:'lineAlpha',      label:'Line Opacity',    min:0.1, max:1.0,  step:0.05, default:1.0  },
    { kind:'slider', key:'haloWidth',      label:'Halo Width',      min:0.0, max:0.60, step:0.01, default:0.00 },
    { kind:'slider', key:'haloBoost',      label:'Halo Boost',      min:0.0, max:3.0,  step:0.05, default:0.00 },
    { kind:'slider', key:'heightGain',  label:'Height Gain',      min:0.0,max:100.0, step:0.01, default:30.0 },
    { kind:'slider', key:'cols',        label:'Grid Columns',     min:64,  max:256, step:1,   default:128 },
    { kind:'slider', key:'rows',        label:'Grid Rows',        min:64,  max:512, step:1,   default:256 },

  ]
  state: Record<string, any> = {}

  private grid!: THREE.Mesh

  private u!: {
    uScroll:    { value: number }
    uStep:      { value: number }
    uWidth:     { value: number }
    uFadeDepth: { value: number }
    uHue:       { value: number }
    uLineBrightness: { value: number }
    uLineAlpha:      { value: number }
    uHaloWidth:      { value: number }
    uHaloBoost:      { value: number }
    uHeightTex: { value: THREE.DataTexture }
    uHFSize:    { value: THREE.Vector2 }
    uRowHead:   { value: number }
    uHeightGain:{ value: number }
    uRowStepW:  { value: number }
  }

  private scroll = 0
  private prevScroll = 0
  private WORLD_W = 160
  private WORLD_D = 120
  private hfTex!: THREE.DataTexture
  private hfArray!: Float32Array
  private hfW = 128
  private hfH = 256
  private rowHead = 0
  private rowStepWorld = 0
  private tmpRow!: Float32Array

  init(ctx: LayerContext): void {
    createStateFromControls(this)

    // Wide, deep plane; grid computed in world units (XZ), not UV
    // Heightfield setup (ring-buffer texture)
    this.hfW = Math.max(2, Math.floor(((this.state.cols as number) ?? 96)))
    this.hfH = Math.max(2, Math.floor(((this.state.rows as number) ?? 192)))
    this.hfArray = new Float32Array(this.hfW * this.hfH)
    this.tmpRow = new Float32Array(this.hfW)
    this.hfTex = new THREE.DataTexture(this.hfArray, this.hfW, this.hfH, THREE.RedFormat, THREE.FloatType)
    this.hfTex.needsUpdate = true
    this.hfTex.wrapS = THREE.RepeatWrapping
    this.hfTex.wrapT = THREE.RepeatWrapping
    // Voxel look: crisp sampling per cell
    this.hfTex.magFilter = THREE.NearestFilter
    this.hfTex.minFilter = THREE.NearestFilter
    this.rowHead = 0
    this.prevScroll = 0
    this.rowStepWorld = this.WORLD_D / Math.max(1, this.hfH - 1)

    // Align mesh to texture grid so edges land on cell borders
    const geo = new THREE.PlaneGeometry(this.WORLD_W, this.WORLD_D, this.hfW - 1, this.hfH - 1)
    geo.rotateX(-Math.PI / 2)
    geo.translate(0, -0.65, -8.0)

    this.u = {
      uScroll:    { value: 0 },
      uStep:      { value: this.state.gridStep },
      uWidth:     { value: this.state.lineWidth },
      uFadeDepth: { value: this.state.fadeDepth },
      uHue:       { value: this.state.hue },
      uLineBrightness: { value: (this.state.lineBrightness as number) ?? 1.25 },
      uLineAlpha:      { value: (this.state.lineAlpha as number) ?? 1.0 },
      uHaloWidth:      { value: (this.state.haloWidth as number) ?? 0.0 },
      uHaloBoost:      { value: (this.state.haloBoost as number) ?? 0.0 },
      uHeightTex: { value: this.hfTex },
      uHFSize:    { value: new THREE.Vector2(this.hfW, this.hfH) },
      uRowHead:   { value: this.rowHead },
      uHeightGain:{ value: (this.state.heightGain as number) ?? 1.0 },
      uRowStepW:  { value: this.rowStepWorld },
    }

    const mat = new THREE.ShaderMaterial({
      uniforms: this.u,
      transparent: true,
      premultipliedAlpha: true,
      blending: THREE.NormalBlending,
      depthWrite: true,
      side: THREE.DoubleSide,
      // WebGL2 / GLSL3
      glslVersion: THREE.GLSL3,
      vertexShader: /* glsl */`
        precision highp float;

        out vec2 vXZ;
        out float vViewZ;

        uniform sampler2D uHeightTex;
        uniform vec2  uHFSize;
        uniform int   uRowHead;
        uniform float uHeightGain;
        uniform float uScroll;   // 0..1 between rows

        void main() {
          // attributes position and uv are provided by Three.js (GLSL3)
          float gx = uv.x * (uHFSize.x - 1.0);
          float gz = uv.y * (uHFSize.y - 1.0);

          // Newest row sits at rowHead, scrolls toward camera as uScroll increases
          float rowF = float(uRowHead) - gz + uScroll;
          // Snap to texel centers (nearest sampling for hard edges)
          vec2 texel = floor(vec2(gx, rowF));
          vec2 texUV = (texel + 0.5) / uHFSize;

          float h = texture(uHeightTex, texUV).r * uHeightGain;

          vec4 mv = modelViewMatrix * vec4(position.x, position.y + h, position.z, 1.0);
          vViewZ = -mv.z;
          vXZ = vec2(position.x, position.z);
          gl_Position = projectionMatrix * mv;
        }
      `,
      fragmentShader: /* glsl */`
        precision highp float;
        in vec2 vXZ;
        in float vViewZ;
        out vec4 outColor;

        uniform float uScroll, uStep, uWidth, uFadeDepth, uHue, uRowStepW;
        uniform float uLineBrightness, uLineAlpha, uHaloWidth, uHaloBoost;
        uniform int   uRowHead;

        vec3 hsl2rgb(vec3 c){
          vec3 p = abs(fract(c.xxx + vec3(0., 2./3., 1./3.)) * 6. - 3.);
          vec3 rgb = c.z + c.y * (clamp(p - 1., 0., 1.) - 0.5) * (1. - abs(2.*c.z - 1.));
          return rgb;
        }

        float gridMask(vec2 uv, float stepSize, float lineWidth){
          vec2 g = abs(fract(uv / stepSize) - 0.5);
          float d = min(g.x, g.y);
          float aa = max(0.75, fwidth(d) * 1.25);
          return 1.0 - smoothstep(lineWidth*0.5 - aa, lineWidth*0.5 + aa, d);
        }

        void main(){
          vec2 uv = vXZ;
          uv.y += (float(uRowHead) + uScroll) * uRowStepW;

          float core = gridMask(uv, uStep, uWidth);

          float halo = 0.0;
          if (uHaloWidth > 0.0) {
            float outer = gridMask(uv, uStep, uWidth + uHaloWidth);
            halo = max(0.0, outer - core);
          }

          vec3 baseColor = hsl2rgb(vec3(uHue, 0.95, 0.60));
          vec3 coreColor = baseColor * uLineBrightness;
          vec3 haloColor = coreColor * uHaloBoost;

          float depthAlpha = exp(-uFadeDepth * vViewZ);
          float aCore = core * uLineAlpha * depthAlpha;
          float aHalo = halo * clamp(uLineAlpha, 0.0, 1.0) * depthAlpha;

          vec3 rgb = coreColor * aCore + haloColor * aHalo;
          float a  = aCore + aHalo;

          outColor = vec4(rgb, a);
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
    this.scroll = (this.scroll - (dt * 0.001) * speed) % 1.0 // 0..1 between rows
    if (this.scroll < 0) this.scroll += 1.0

    // push uniforms
    this.u.uScroll.value    = this.scroll
    this.u.uStep.value      = step
    this.u.uWidth.value     = width
    this.u.uFadeDepth.value = fadeDepth
    this.u.uHue.value       = hue
    this.u.uLineBrightness.value = (this.state.lineBrightness as number) ?? 1.25
    this.u.uLineAlpha.value      = (this.state.lineAlpha as number) ?? 1.0
    this.u.uHaloWidth.value      = (this.state.haloWidth as number) ?? 0.0
    this.u.uHaloBoost.value      = (this.state.haloBoost as number) ?? 0.0

    // Write a new heightfield row when we cross a row boundary
    if (this.scroll > this.prevScroll) {
      // advance head (newest row at horizon)
      this.rowHead = (this.rowHead - 1 + this.hfH) % this.hfH

      // --- build the new profile (voxelized across X blocks) ---
      const bins = f.binsLog
      const bakeGain = (this.state.heightGain as number) ?? 1.0
      const targetCols = this.hfW
      // Blocked columns: fill flat per block for crisp vertical edges
      const cellsX = 48
      const blockW = Math.max(1, Math.floor(targetCols / cellsX))
      for (let bx = 0; bx < cellsX; bx++) {
        const x0 = bx * blockW
        const x1 = Math.min(targetCols, x0 + blockW)
        const tCenter = ((x0 + x1) * 0.5) / Math.max(1, targetCols - 1)
        const idx = tCenter * Math.max(1, bins.length - 1)
        const i0 = Math.floor(idx)
        const i1 = Math.min(i0 + 1, bins.length - 1)
        const fL = idx - i0
        const vBlock = ((1 - fL) * bins[i0] + fL * bins[i1])
        for (let x = x0; x < x1; x++) this.tmpRow[x] = vBlock
      }
      // 3) paint new row + blend into a few following rows to give “thickness”
      const roadWidth   = Math.max(0, (this.state.roadWidth as number) ?? 20)
      const roadFeather = Math.max(0, (this.state.roadFeather as number) ?? 8)
      const halfRoad = roadWidth * 0.5
      const feather  = roadFeather
      const FALLOFF_ROWS = 3
      const SIGMA = 2.0
      for (let k = 0; k <= FALLOFF_ROWS; k++) {
        const w = Math.exp(-(k * k) / (2.0 * SIGMA * SIGMA))
        const row = (this.rowHead + k) % this.hfH
        const base = row * this.hfW
        for (let x = 0; x < targetCols; x++) {
          const t = x / Math.max(1, targetCols - 1)
          const worldX = (t - 0.5) * this.WORLD_W
          const d = Math.abs(worldX)
          let mask = 1
          if (feather <= 1e-6) {
            mask = d > halfRoad ? 1 : 0
          } else {
            if (d <= halfRoad) mask = 0
            else if (d >= halfRoad + feather) mask = 1
            else {
              const kk = (d - halfRoad) / feather
              mask = kk * kk * (3.0 - 2.0 * kk)
            }
          }
          const vNew = this.tmpRow[x] * bakeGain * mask
          const vOld = this.hfArray[base + x]
          this.hfArray[base + x] = vOld * (1 - w) + vNew * w
        }
      }
      this.hfTex.needsUpdate = true
      this.u.uRowHead.value = this.rowHead
      this.u.uHeightGain.value = 1.0
    }
    this.prevScroll = this.scroll

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
