<template>
  <div class="layer-controls">
    <div
      v-for="layer in layers"
      :key="layer.id"
      class="layer-block"
    >
      <div class="layer-header">
        <h4>{{ layer.label }}</h4>
        <small>{{ layer.id }}</small>
      </div>
      <div class="controls">
        <div v-for="ctrl in layer.controls" :key="ctrl.key" class="control-row">
          <template v-if="ctrl.kind === 'slider'">
            <label :for="layer.id + ':' + ctrl.key">{{ ctrl.label }}</label>
            <input
              :id="layer.id + ':' + ctrl.key"
              type="range"
              :min="(ctrl as any).min"
              :max="(ctrl as any).max"
              :step="(ctrl as any).step"
              v-model.number="layer.state[ctrl.key]"
              @input="persist(layer)"
            />
            <span class="value">{{ formatNumber(layer.state[ctrl.key]) }}</span>
          </template>
          <template v-else-if="ctrl.kind === 'toggle'">
            <label class="toggle">
              <input type="checkbox" v-model="layer.state[ctrl.key]" @change="persist(layer)" />
              <span>{{ ctrl.label }}</span>
            </label>
          </template>
          <template v-else-if="ctrl.kind === 'select'">
            <label :for="layer.id + ':' + ctrl.key">{{ ctrl.label }}</label>
            <select :id="layer.id + ':' + ctrl.key" v-model="layer.state[ctrl.key]" @change="persist(layer)">
              <option v-for="opt in (ctrl as any).options" :key="opt.value" :value="opt.value">{{ opt.label }}</option>
            </select>
          </template>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { registry, saveState } from '../../engine/layers'

interface Props {
  layerIds: string[]
}
const props = defineProps<Props>()

const layers = computed(() => props.layerIds.map(id => registry.get(id)).filter(Boolean) as any)

function persist(layer: any) {
  saveState(layer.id, layer.state)
}

function formatNumber(v: any) {
  if (typeof v !== 'number') return String(v)
  const a = Math.abs(v)
  return a >= 10 ? v.toFixed(1) : v.toFixed(2)
}
</script>

<style scoped>
.layer-controls {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.layer-block {
  padding: 12px;
  border: 1px solid rgba(255,255,255,0.12);
  border-radius: 8px;
  background: rgba(255,255,255,0.05);
}
.layer-header {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  margin-bottom: 8px;
}
.layer-header h4 {
  margin: 0;
  font-size: 14px;
  color: #64ffda;
}
.controls {
  display: grid;
  grid-template-columns: 1fr auto 56px;
  gap: 8px 10px;
}
.control-row { display: contents; }
label { font-size: 12px; color: #ddd; }
input[type="range"] { width: 100%; }
.toggle { display: flex; align-items: center; gap: 8px; grid-column: 1 / -1; }
select { width: 100%; }
.value { text-align: right; font-size: 12px; color: #aaa; }
</style>


