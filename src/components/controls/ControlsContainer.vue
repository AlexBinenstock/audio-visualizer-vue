<script setup lang="ts">
import CollapsibleSection from '../ui/CollapsibleSection.vue'
import MicrophoneControls from './MicrophoneControls.vue'
import FileUploadControls from './FileUploadControls.vue'

interface Props {
  isMicActive: boolean
  canUseMic: boolean
  audioFile: File | null
  isPlaying: boolean
  duration: number
  currentTime: number
  error: string | null
}

interface Emits {
  (e: 'start-microphone'): void
  (e: 'stop-microphone'): void
  (e: 'file-upload', file: File | null): void
  (e: 'play'): void
  (e: 'pause'): void
  (e: 'stop'): void
  (e: 'seek', time: number): void
}

const props = defineProps<Props>()
const emit = defineEmits<Emits>()

const startMicrophone = () => {
  emit('start-microphone')
}

const stopMicrophone = () => {
  emit('stop-microphone')
}

const handleFileUpload = (file: File | null) => {
  emit('file-upload', file)
}

const handlePlay = () => {
  emit('play')
}

const handlePause = () => {
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
  <div class="controls-container">
    <CollapsibleSection title="Audio Controls" id="audio-controls" :default-expanded="true">
      <div class="controls-content">
        <MicrophoneControls
          :is-mic-active="isMicActive"
          :can-use-mic="canUseMic"
          @start-microphone="startMicrophone"
          @stop-microphone="stopMicrophone"
        />
        
        <FileUploadControls
          :audio-file="audioFile"
          :is-playing="isPlaying"
          :duration="duration"
          :current-time="currentTime"
          :error="error"
          @file-upload="handleFileUpload"
          @play="handlePlay"
          @pause="handlePause"
          @stop="handleStop"
          @seek="handleSeek"
        />
      </div>
    </CollapsibleSection>
  </div>
</template>

<style scoped>
.controls-container {
  width: 100%;
  max-width: 600px;
}

.controls-content {
  display: flex;
  flex-direction: column;
  gap: 24px;
}
</style>
