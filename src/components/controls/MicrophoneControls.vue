<script setup lang="ts">
interface Props {
  isMicActive: boolean
  canUseMic: boolean
}

interface Emits {
  (e: 'start-microphone'): void
  (e: 'stop-microphone'): void
}

defineProps<Props>()
const emit = defineEmits<Emits>()

const handleStartMicrophone = () => {
  emit('start-microphone')
}

const handleStopMicrophone = () => {
  emit('stop-microphone')
}
</script>

<template>
  <div class="control-content">
    <h3>Microphone Input</h3>
    <div class="microphone-controls">
      <button 
        v-if="!isMicActive"
        @click="handleStartMicrophone" 
        :disabled="!canUseMic"
        class="btn btn-primary"
      >
        Use Microphone
      </button>
      <button 
        v-else
        @click="handleStopMicrophone" 
        class="btn btn-secondary"
      >
        Stop Microphone
      </button>
      <div v-if="!canUseMic && !isMicActive" class="mic-disabled">
        <small>Microphone disabled while audio is playing</small>
      </div>
    </div>
  </div>
</template>

<style scoped>
.control-content {
  padding: 1.5rem;
}

.control-content h3 {
  margin: 0 0 1rem 0;
  color: var(--accent-color);
  font-size: 1.2rem;
  font-weight: 600;
}

.microphone-controls {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.microphone-controls .btn {
  padding: 0.75rem 1.5rem;
  border: none;
  border-radius: 8px;
  font-size: 1rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;
}

.btn-primary {
  background: linear-gradient(135deg, #64ffda 0%, #00bcd4 100%);
  color: #0f0f23;
}

.btn-primary:hover:not(:disabled) {
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(100, 255, 218, 0.3);
}

.btn-primary:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn-secondary {
  background: linear-gradient(135deg, #ff6b6b 0%, #ee5a24 100%);
  color: white;
}

.btn-secondary:hover {
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(255, 107, 107, 0.3);
}

.mic-disabled {
  color: #888;
  font-style: italic;
}
</style>
