<template>
  <div class="visualizer-selector">
    <h4>Visualizer Layers</h4>
    <div class="selector-options">
      <label v-for="option in visualizerOptions" :key="option.value" class="selector-option"
        :class="{ 'active': modelValue.includes(option.value) }">
        <input type="checkbox" :value="option.value" :checked="modelValue.includes(option.value)"
          @change="toggleLayer(option.value)" class="layer-checkbox" />
        <span class="option-icon">{{ option.icon }}</span>
        <span class="option-label">{{ option.label }}</span>
      </label>
    </div>
    <div class="layer-info">
      <small>Select multiple layers to overlay them</small>
      <div class="active-layers" v-if="modelValue.length > 1">
        <small>Active: {{ modelValue.join(', ') }}</small>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
interface VisualizerOption {
  value: string
  label: string
  icon: string
}

interface Props {
  modelValue: string[]
}

interface Emits {
  (e: 'update:modelValue', value: string[]): void
}

const props = defineProps<Props>()
const emit = defineEmits<Emits>()

const visualizerOptions: VisualizerOption[] = [
  {
    value: 'synthwave',
    label: 'Synthwave',
    icon: '🌆'
  },
  {
    value: 'debug',
    label: 'Debug Bars',
    icon: '📊'
  },
  {
    value: 'simple',
    label: 'Simple',
    icon: '⭕'
  },
  {
    value: 'circle',
    label: 'Cannon Fireworks',
    icon: '🎆'
  },
  {
    value: 'synth',
    label: 'Synthwave World',
    icon: '🌆'
  }
]

const toggleLayer = (value: string) => {
  const newLayers = [...props.modelValue]
  const index = newLayers.indexOf(value)

  if (index > -1) {
    // Remove layer
    newLayers.splice(index, 1)
  } else {
    // Add layer
    newLayers.push(value)
  }

  // Ensure at least one layer is selected
  if (newLayers.length === 0) {
    newLayers.push('debug')
  }

  emit('update:modelValue', newLayers)
}
</script>

<style scoped>
.visualizer-selector {
  margin-bottom: 1rem;
  padding: 1rem;
  background: rgba(255, 255, 255, 0.05);
  border-radius: 8px;
  border: 1px solid rgba(255, 255, 255, 0.1);
}

.visualizer-selector h4 {
  margin: 0 0 1rem 0;
  color: #64ffda;
  font-size: 1rem;
  font-weight: 500;
}

.selector-options {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  margin-bottom: 0.75rem;
}

.selector-option {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.75rem;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 6px;
  color: #ccc;
  cursor: pointer;
  transition: all 0.2s ease;
  user-select: none;
}

.selector-option:hover {
  background: rgba(255, 255, 255, 0.1);
  border-color: rgba(255, 255, 255, 0.2);
  transform: translateX(2px);
}

.selector-option.active {
  background: rgba(100, 255, 218, 0.1);
  border-color: #64ffda;
  color: #64ffda;
}

.layer-checkbox {
  width: 16px;
  height: 16px;
  accent-color: #64ffda;
  cursor: pointer;
}

.option-icon {
  font-size: 1.2rem;
  min-width: 1.2rem;
  text-align: center;
}

.option-label {
  font-size: 0.9rem;
  font-weight: 500;
  flex: 1;
}

.layer-info {
  text-align: center;
  color: #888;
  font-size: 0.8rem;
}

.layer-info small {
  opacity: 0.8;
}

.active-layers {
  margin-top: 0.5rem;
  padding: 0.5rem;
  background: rgba(100, 255, 218, 0.1);
  border-radius: 4px;
  border: 1px solid rgba(100, 255, 218, 0.2);
}

.active-layers small {
  color: #64ffda;
  font-weight: 500;
}
</style>
