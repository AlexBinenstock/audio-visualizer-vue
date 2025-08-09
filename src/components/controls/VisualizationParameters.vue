<script setup lang="ts">


interface Props {
  sensitivity: number
  decay: number
  frequencyMapping: 'logarithmic' | 'linear'
}

interface Emits {
  (e: 'sensitivity-change', event: Event): void
  (e: 'decay-change', event: Event): void
  (e: 'frequency-mapping-change', value: 'logarithmic' | 'linear'): void
}

defineProps<Props>()
const emit = defineEmits<Emits>()

// Utility functions for descriptions
const getDecayDescription = (decayValue: number): string => {
  if (decayValue <= 0.3) return "Very fast decay - peaks disappear in milliseconds"
  if (decayValue <= 0.5) return "Fast decay - peaks fade in under a second"
  if (decayValue <= 0.7) return "Medium decay - peaks linger for a few seconds"
  if (decayValue <= 0.85) return "Slow decay - peaks persist for several seconds"
  return "Very slow decay - peaks persist for many seconds"
}

const getSensitivityDescription = (sensitivityValue: number): string => {
  if (sensitivityValue <= 0.5) return "Quiet - sensitive to subtle sounds"
  if (sensitivityValue <= 1.0) return "Medium - balanced sensitivity"
  if (sensitivityValue <= 2.0) return "Loud - sensitive to louder sounds"
  return "Very loud - extremely sensitive"
}

const handleSensitivityChange = (event: Event) => {
  emit('sensitivity-change', event)
}

const handleDecayChange = (event: Event) => {
  emit('decay-change', event)
}

const handleFrequencyMappingChange = (event: Event) => {
  const target = event.target as HTMLSelectElement
  emit('frequency-mapping-change', target.value as 'logarithmic' | 'linear')
}
</script>

<template>
  <div class="control-group">
    <h3>Visualization Parameters</h3>
    <div class="parameter-controls">
      <div class="parameter">
        <label for="sensitivity">Sensitivity: {{ sensitivity.toFixed(2) }}</label>
        <div class="sensitivity-description">
          {{ getSensitivityDescription(sensitivity) }}
        </div>
        <input 
          id="sensitivity"
          type="range" 
          :value="sensitivity" 
          @input="handleSensitivityChange"
          min="0.1" 
          max="3.0" 
          step="0.1"
          class="slider"
        />
        <div class="sensitivity-info">
          <span class="sensitivity-label">Quiet (0.1)</span>
          <span class="sensitivity-label">Loud (3.0)</span>
        </div>
      </div>
      
      <div class="parameter">
        <label for="decay" class="decay-label" :class="{ 'decay-active': decay > 0.7 }">
          Decay: {{ decay.toFixed(2) }}
          <span v-if="decay > 0.7" class="decay-indicator">●</span>
        </label>
        <div class="decay-description">
          {{ getDecayDescription(decay) }}
        </div>
        <input 
          id="decay"
          type="range" 
          :value="decay" 
          @input="handleDecayChange"
          min="0.1" 
          max="0.95" 
          step="0.05"
          class="slider"
        />
        <div class="decay-info">
          <span class="decay-label">Fast (0.1)</span>
          <span class="decay-label">Slow (0.95)</span>
        </div>
      </div>
      
      <div class="parameter">
        <label for="frequency-mapping">Frequency Mapping</label>
        <select 
          id="frequency-mapping"
          :value="frequencyMapping"
          @change="handleFrequencyMappingChange"
          class="select-control"
        >
          <option value="logarithmic">Mel-Scale (20Hz-8kHz - Full 360°)</option>
          <option value="linear">Linear (Equal Distribution)</option>
        </select>
      </div>
    </div>
  </div>
</template>

<style scoped>
.control-group {
  margin-bottom: 2rem;
  padding: 1.5rem;
  background: rgba(255, 255, 255, 0.05);
  border-radius: 12px;
  border: 1px solid rgba(255, 255, 255, 0.1);
}

.control-group h3 {
  margin: 0 0 1rem 0;
  color: #64ffda;
  font-size: 1.2rem;
  font-weight: 600;
}

.parameter-controls {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.parameter {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.parameter label {
  font-weight: 600;
  color: #ffffff;
  font-size: 1rem;
}

.sensitivity-description,
.decay-description {
  font-size: 0.9rem;
  color: #ccc;
  font-style: italic;
}

.slider {
  width: 100%;
  height: 6px;
  background: rgba(255, 255, 255, 0.1);
  border-radius: 3px;
  outline: none;
  -webkit-appearance: none;
}

.slider::-webkit-slider-thumb {
  -webkit-appearance: none;
  appearance: none;
  width: 20px;
  height: 20px;
  background: #64ffda;
  border-radius: 50%;
  cursor: pointer;
  transition: all 0.2s ease;
}

.slider::-webkit-slider-thumb:hover {
  background: #00bcd4;
  transform: scale(1.1);
}

.slider::-moz-range-thumb {
  width: 20px;
  height: 20px;
  background: #64ffda;
  border-radius: 50%;
  cursor: pointer;
  border: none;
  transition: all 0.2s ease;
}

.slider::-moz-range-thumb:hover {
  background: #00bcd4;
  transform: scale(1.1);
}

.sensitivity-info,
.decay-info {
  display: flex;
  justify-content: space-between;
  font-size: 0.8rem;
  color: #999;
}

.select-control {
  padding: 0.75rem;
  background: rgba(255, 255, 255, 0.1);
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 8px;
  color: white;
  font-size: 1rem;
  cursor: pointer;
}

.select-control:focus {
  outline: none;
  border-color: #64ffda;
  box-shadow: 0 0 0 2px rgba(100, 255, 218, 0.2);
}

.decay-label {
  font-weight: 600;
  color: #ffffff;
  font-size: 1rem;
  transition: color 0.3s ease;
}

.decay-label.decay-active {
  color: #64ffda;
}

.decay-indicator {
  color: #64ffda;
  margin-left: 0.5rem;
  animation: pulse 2s infinite;
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}
</style>
