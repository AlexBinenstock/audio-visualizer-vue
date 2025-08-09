<script setup lang="ts">
import type { AudioInputDevice } from '../../lib/audio'

interface Props {
  audioDevices: AudioInputDevice[]
  selectedDeviceId: string
  isMicActive: boolean
}

interface Emits {
  (e: 'device-change', deviceId: string): void
  (e: 'start-microphone'): void
}

defineProps<Props>()
const emit = defineEmits<Emits>()

const handleDeviceChange = (event: Event) => {
  const target = event.target as HTMLSelectElement
  // Update the selected device ID in the parent
  emit('device-change', target.value)
}

const handleStartMicrophone = () => {
  emit('start-microphone')
}
</script>

<template>
  <div class="control-group">
    <h3>Microphone Input</h3>
    <div class="device-selector">
      <select :value="selectedDeviceId" @change="handleDeviceChange">
        <option value="">Select microphone...</option>
        <option 
          v-for="device in audioDevices" 
          :key="device.deviceId" 
          :value="device.deviceId"
        >
          {{ device.label }}
        </option>
      </select>
      <button 
        @click="handleStartMicrophone" 
        :disabled="isMicActive"
        class="btn btn-primary"
      >
        {{ isMicActive ? 'Microphone Active' : 'Use Microphone' }}
      </button>
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

.device-selector {
  display: flex;
  gap: 1rem;
  align-items: center;
  flex-wrap: wrap;
}

.device-selector select {
  flex: 1;
  min-width: 200px;
  padding: 0.75rem;
  background: rgba(255, 255, 255, 0.1);
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 8px;
  color: white;
  font-size: 1rem;
}

.device-selector select:focus {
  outline: none;
  border-color: #64ffda;
  box-shadow: 0 0 0 2px rgba(100, 255, 218, 0.2);
}

.btn {
  padding: 0.75rem 1.5rem;
  border: none;
  border-radius: 8px;
  font-size: 1rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;
}

.btn-primary {
  background: #64ffda;
  color: #0f0f23;
}

.btn-primary:hover:not(:disabled) {
  background: #00bcd4;
  transform: translateY(-1px);
}

.btn-primary:disabled {
  background: #666;
  color: #999;
  cursor: not-allowed;
  transform: none;
}
</style>
