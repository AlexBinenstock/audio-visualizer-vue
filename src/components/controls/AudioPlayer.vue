<template>
  <div class="audio-player">
    <div class="file-info" v-if="audioFile">
      <div class="file-name">{{ audioFile.name }}</div>
      <div class="file-duration">{{ formatDuration(duration) }}</div>
    </div>
    
    <div class="controls">
      <button 
        @click="togglePlayback" 
        :disabled="!audioFile"
        class="play-button"
        :class="{ 'playing': isPlaying }"
      >
        {{ isPlaying ? '⏸️' : '▶️' }}
      </button>
      
      <div class="progress-container">
        <div class="time-display">
          <span class="current-time">{{ formatTime(currentTime) }}</span>
          <span class="total-time">{{ formatTime(duration) }}</span>
        </div>
        
        <div class="progress-bar">
          <input
            type="range"
            :min="0"
            :max="duration"
            :value="currentTime"
            @input="seekTo"
            @change="seekTo"
            class="progress-slider"
            :disabled="!audioFile"
          />
          <div 
            class="progress-fill" 
            :style="{ width: progressPercentage + '%' }"
          ></div>
        </div>
      </div>
      
      <button 
        @click="stopPlayback" 
        :disabled="!audioFile || !isPlaying"
        class="stop-button"
      >
        ⏹️
      </button>
    </div>
    
    <div class="status" v-if="audioFile">
      <span class="status-text" :class="{ 'error': error }">
        {{ statusText }}
      </span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'

interface Props {
  audioFile: File | null
  isPlaying: boolean
  duration: number
  currentTime: number
  error: string | null
}

interface Emits {
  (e: 'play'): void
  (e: 'pause'): void
  (e: 'stop'): void
  (e: 'seek', time: number): void
}

const props = defineProps<Props>()
const emit = defineEmits<Emits>()

// Local state for progress updates
const localCurrentTime = ref(0)
const progressUpdateInterval = ref<number | null>(null)

// Computed
const progressPercentage = computed(() => {
  if (props.duration <= 0) return 0
  return (localCurrentTime.value / props.duration) * 100
})

const statusText = computed(() => {
  if (props.error) return `Error: ${props.error}`
  if (!props.audioFile) return 'No file loaded'
  if (props.isPlaying) return 'Playing'
  return 'Paused'
})

// Methods
const togglePlayback = () => {
  if (props.isPlaying) {
    emit('pause')
  } else {
    emit('play')
  }
}

const stopPlayback = () => {
  emit('stop')
}

const seekTo = (event: Event) => {
  const target = event.target as HTMLInputElement
  const time = parseFloat(target.value)
  emit('seek', time)
}

const formatTime = (seconds: number): string => {
  if (isNaN(seconds) || seconds < 0) return '0:00'
  
  const mins = Math.floor(seconds / 60)
  const secs = Math.floor(seconds % 60)
  return `${mins}:${secs.toString().padStart(2, '0')}`
}

const formatDuration = (seconds: number): string => {
  if (isNaN(seconds) || seconds <= 0) return ''
  
  const mins = Math.floor(seconds / 60)
  const secs = Math.floor(seconds % 60)
  return `${mins}:${secs.toString().padStart(2, '0')}`
}

// Progress update loop
const startProgressUpdates = () => {
  if (progressUpdateInterval.value) return
  
  progressUpdateInterval.value = window.setInterval(() => {
    if (props.isPlaying && props.duration > 0) {
      // Update local time for smooth progress bar movement
      localCurrentTime.value = Math.min(
        localCurrentTime.value + 0.1, 
        props.duration
      )
    }
  }, 100)
}

const stopProgressUpdates = () => {
  if (progressUpdateInterval.value) {
    clearInterval(progressUpdateInterval.value)
    progressUpdateInterval.value = null
  }
}

// Watch for changes
watch(() => props.currentTime, (newTime) => {
  localCurrentTime.value = newTime
})

watch(() => props.isPlaying, (playing) => {
  if (playing) {
    startProgressUpdates()
  } else {
    stopProgressUpdates()
  }
})

// Lifecycle
onMounted(() => {
  if (props.isPlaying) {
    startProgressUpdates()
  }
})

onUnmounted(() => {
  stopProgressUpdates()
})
</script>

<style scoped>
.audio-player {
  background: #2a2a2a;
  border-radius: 8px;
  padding: 16px;
  margin: 16px 0;
  border: 1px solid #444;
}

.file-info {
  margin-bottom: 12px;
  text-align: center;
}

.file-name {
  font-weight: 600;
  color: #fff;
  margin-bottom: 4px;
  word-break: break-word;
}

.file-duration {
  font-size: 0.9em;
  color: #aaa;
}

.controls {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 12px;
}

.play-button, .stop-button {
  background: #4a4a4a;
  border: none;
  border-radius: 50%;
  width: 40px;
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.2s;
  font-size: 16px;
}

.play-button:hover:not(:disabled) {
  background: #5a5a5a;
  transform: scale(1.05);
}

.play-button.playing {
  background: #4CAF50;
}

.stop-button:hover:not(:disabled) {
  background: #5a5a5a;
  transform: scale(1.05);
}

.play-button:disabled, .stop-button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.progress-container {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.time-display {
  display: flex;
  justify-content: space-between;
  font-size: 0.8em;
  color: #aaa;
}

.progress-bar {
  position: relative;
  height: 6px;
  background: #444;
  border-radius: 3px;
  overflow: hidden;
}

.progress-slider {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  opacity: 0;
  cursor: pointer;
  z-index: 2;
}

.progress-fill {
  position: absolute;
  top: 0;
  left: 0;
  height: 100%;
  background: linear-gradient(90deg, #4CAF50, #8BC34A);
  border-radius: 3px;
  transition: width 0.1s ease;
}

.status {
  text-align: center;
  font-size: 0.9em;
}

.status-text {
  color: #aaa;
}

.status-text.error {
  color: #f44336;
}
</style>
