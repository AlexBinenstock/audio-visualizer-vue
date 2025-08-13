import * as THREE from 'three'

export type Control =
  | { kind: 'slider'; key: string; label: string; min: number; max: number; step: number; default: number }
  | { kind: 'toggle'; key: string; label: string; default: boolean }
  | { kind: 'select'; key: string; label: string; options: { label: string; value: string }[]; default: string }

export type LayerContext = {
  scene: THREE.Scene
  camera: THREE.PerspectiveCamera
  renderer: THREE.WebGLRenderer
  canvas: HTMLCanvasElement
  dpr: number
  size: { w: number; h: number }
}

export interface Layer {
  id: string
  label: string
  controls: Control[]
  state: Record<string, any>
  init(ctx: LayerContext): void
  update(ctx: LayerContext, f: import('./features').Features): void
  setEnabled(on: boolean): void
  dispose(): void
}

export class LayerRegistry {
  private layers = new Map<string, Layer>()
  register(layer: Layer) { this.layers.set(layer.id, layer) }
  get(id: string) { return this.layers.get(id) }
  all() { return [...this.layers.values()] }
}

export const registry = new LayerRegistry()

const STORAGE_PREFIX = 'reveri.layer.state.'

export function createStateFromControls(layer: Layer) {
  const saved = loadState(layer.id)
  const base: Record<string, any> = {}
  for (const c of layer.controls) {
    if (c.kind === 'slider') base[c.key] = c.default
    else if (c.kind === 'toggle') base[c.key] = c.default
    else if (c.kind === 'select') base[c.key] = c.default
  }
  layer.state = { ...base, ...saved }
}

export function saveState(id: string, state: Record<string, any>) {
  try {
    localStorage.setItem(STORAGE_PREFIX + id, JSON.stringify(state))
  } catch {}
}

export function loadState(id: string): Record<string, any> {
  try {
    const raw = localStorage.getItem(STORAGE_PREFIX + id)
    return raw ? JSON.parse(raw) : {}
  } catch {
    return {}
  }
}


