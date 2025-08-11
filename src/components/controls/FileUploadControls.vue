<script setup lang="ts">
import { computed } from 'vue'
import AudioPlayer from './AudioPlayer.vue'

interface Props {
  audioFile: File | null
  isPlaying: boolean
  duration: number
  currentTime: number
  error: string | null
}

interface Emits {
  (e: 'file-upload', file: File | null): void
  (e: 'play'): void
  (e: 'pause'): void
  (e: 'stop'): void
  (e: 'seek', time: number): void
}

const props = defineProps<Props>()
const emit = defineEmits<Emits>()

const handleFileChange = (event: Event) => {
  const target = event.target as HTMLInputElement
  const file = target.files?.[0] || null
  emit('file-upload', file)
}

const clearFile = () => {
  emit('file-upload', null)
}

const handlePlay = () => {
  console.log('🎵 FileUploadControls.vue: Play event received!')
  emit('play')
}

const handlePause = () => {
  console.log('⏸️ FileUploadControls.vue: Pause event received!')
  emit('pause')
}

const handleStop = () => {
  emit('stop')
}

const handleSeek = (time: number) => {
  emit('seek', time)
}
</script>

<template>
  <div class="file-upload-controls">
    <div class="file-input-section">
      <label for="audio-file" class="file-input-label">
        <span class="upload-icon">📁</span>
        Choose Audio File
      </label>
      <input
        id="audio-file"
        type="file"
        accept="audio/*"
        @change="handleFileChange"
        class="file-input"
      />
      
      <button 
        @click="clearFile" 
        v-if="audioFile"
        class="clear-button"
      >
        Clear
      </button>
    </div>
    
    <AudioPlayer
      v-if="audioFile"
      :audio-file="audioFile"
      :is-playing="isPlaying"
      :duration="duration"
      :current-time="currentTime"
      :error="error"
      @play="handlePlay"
      @pause="handlePause"
      @stop="handleStop"
      @seek="handleSeek"
    />
  </div>
</template>

<style scoped>
.file-upload-controls {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.file-input-section {
  display: flex;
  align-items: center;
  gap: 12px;
}

.file-input-label {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 16px;
  background: #4a4a4a;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.2s;
  color: #fff;
  font-weight: 500;
}

.file-input-label:hover {
  background: #5a5a5a;
  transform: translateY(-1px);
}

.upload-icon {
  font-size: 18px;
}

.file-input {
  display: none;
}

.clear-button {
  padding: 8px 16px;
  background: #f44336;
  border: none;
  border-radius: 4px;
  color: white;
  cursor: pointer;
  transition: all 0.2s;
}

.clear-button:hover {
  background: #d32f2f;
  transform: translateY(-1px);
}
</style>
