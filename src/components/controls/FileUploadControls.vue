<script setup lang="ts">
import { ref, watch } from 'vue'

interface Props {
  audioFile: File | null
  currentAnalyser: AnalyserNode | null
  audioElement: HTMLAudioElement | undefined
}

interface Emits {
  (e: 'file-upload', event: Event): void
  (e: 'audio-error', event: Event): void
  (e: 'audio-element-ready', element: HTMLAudioElement): void
}

defineProps<Props>()
const emit = defineEmits<Emits>()

const audioElementRef = ref<HTMLAudioElement>()

// Watch for audio element changes and emit to parent
watch(audioElementRef, (element) => {
  if (element) {
    emit('audio-element-ready', element)
  }
})

const handleFileUpload = (event: Event) => {
  emit('file-upload', event)
}

const handleAudioError = (event: Event) => {
  emit('audio-error', event)
}
</script>

<template>
  <div class="control-group">
    <h3>Audio File Input</h3>
    <div class="file-upload">
      <input 
        type="file" 
        @change="handleFileUpload" 
        accept="audio/*"
        class="file-input"
      />
      <div v-if="audioFile" class="file-info">
        <p class="file-name">{{ audioFile.name }}</p>
        <p class="file-type">{{ audioFile.type || 'Unknown type' }}</p>
      </div>
      <audio 
        ref="audioElementRef"
        v-if="audioFile" 
        controls 
        preload="metadata"
        class="audio-player"
        @error="handleAudioError"
      >
        Your browser does not support the audio element.
      </audio>
      <div v-if="audioFile && !currentAnalyser" class="loading-status">
        <p>Loading audio file...</p>
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

.file-upload {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.file-input {
  padding: 0.75rem;
  background: rgba(255, 255, 255, 0.1);
  border: 2px dashed rgba(255, 255, 255, 0.3);
  border-radius: 8px;
  color: white;
  font-size: 1rem;
  cursor: pointer;
  transition: all 0.2s ease;
}

.file-input:hover {
  border-color: #64ffda;
  background: rgba(100, 255, 218, 0.1);
}

.file-input:focus {
  outline: none;
  border-color: #64ffda;
  box-shadow: 0 0 0 2px rgba(100, 255, 218, 0.2);
}

.file-info {
  padding: 1rem;
  background: rgba(255, 255, 255, 0.05);
  border-radius: 8px;
  border: 1px solid rgba(255, 255, 255, 0.1);
}

.file-name {
  margin: 0 0 0.5rem 0;
  font-weight: 600;
  color: #64ffda;
}

.file-type {
  margin: 0;
  font-size: 0.9rem;
  color: #ccc;
}

.audio-player {
  width: 100%;
  border-radius: 8px;
}

.loading-status {
  text-align: center;
  padding: 1rem;
  color: #64ffda;
  font-style: italic;
}
</style>
