<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import ControlsContainer from './components/controls/ControlsContainer.vue'
import StatusDisplay from './components/ui/StatusDisplay.vue'
import VisualizerSelector from './components/ui/VisualizerSelector.vue'
import LayerHost3D from './components/visualizer/LayerHost3D.vue'
import LayerControls from './components/controls/LayerControls.vue'
import * as Tone from 'tone'
import { registry } from './engine/layers'

import { useSimpleAudioManager } from './composables/useSimpleAudioManager'

// Use simple audio manager
const {
  // State
  isInitialized,
  isMicActive,
  isPlaying,
  currentSource,
  audioFile,
  error,
  duration,
  currentTime,
  
  // Computed
  canUseMic,
  
  // Methods
  initialize,
  startMicrophone,
  stopMicrophone,
  handleFileUpload,
  // unused: startPlayback, pausePlayback, stopPlayback
  getAudioData,
  cleanup,
  handlePlay,
  handlePause,
  handleStop,
  handleSeek
} = useSimpleAudioManager()

// Audio data for visualization
const audioData = ref<Float32Array>(new Float32Array())
const rmsData = ref<Float32Array>(new Float32Array())

// Visualizer selection
const selectedVisualizer = ref<string[]>(['debug'])

// Track source changes to reset feature extractor state downstream
const sourceVersion = ref(0)

const activeLayerIds = () => {
  const resolve = (name: string) => {
    if (name === 'simple') return 'radial-basic-3d'
    if (name === 'debug') return 'audio-debug-bars-3d'
    if (name === 'circle') return 'cannon-fireworks-3d'
    if (name === 'synthwave' || name === 'synth') {
      const found = registry.all().find(l => l.id.toLowerCase().includes('synth'))
      return found ? found.id : name
    }
    return name
  }
  return selectedVisualizer.value.map(resolve).filter((v, i, a) => a.indexOf(v) === i)
}

// Animation loop to get audio data
let animationId: number
let lastAppLogTime: number | null = null
const updateAudioData = () => {
  const newData = getAudioData()
  if (newData.fft && newData.fft.length > 0) {
    audioData.value = newData.fft
    rmsData.value = newData.rms
    
    // Throttle logging to once per second
    const now = Date.now()
    if (!lastAppLogTime || now - lastAppLogTime > 1000) {
      console.log('App: Updated audio data, FFT length:', newData.fft.length, 'RMS length:', newData.rms.length)
      lastAppLogTime = now
    }
  }
  animationId = requestAnimationFrame(updateAudioData)
}

// Event handlers
// (handlers are wired directly to audio manager methods below)

// Add debugging for play events
const onPlay = async () => {
  console.log('🎵 App.vue: Play event received!')
  await handlePlay()
}

const onPause = async () => {
  console.log('⏸️ App.vue: Pause event received!')
  await handlePause()
}

const onStop = async () => {
  console.log('⏹️ App.vue: Stop event received!')
  await handleStop()
}

const onSeek = async (time: number) => {
  console.log('🔍 App.vue: Seek event received!', time)
  await handleSeek(time)
}

onMounted(async () => {
  // Initialize audio system
  await initialize()
  
  // Start audio data update loop
  updateAudioData()
})

onUnmounted(() => {
  if (animationId) {
    cancelAnimationFrame(animationId)
  }
  cleanup()
})

// Bump sourceVersion whenever currentSource changes
// Simple watch implemented via existing handlers that set currentSource
// Mic start
const startMicrophoneWithBump = async () => {
  await startMicrophone()
  sourceVersion.value++
}
// File upload
const handleFileUploadWithBump = async (file: File | null) => {
  await handleFileUpload(file)
  sourceVersion.value++
}
</script>

<template>
  <div class="app">
    <header class="app-header">
      <h1>Reveri</h1>
      <p>Audio Visualizer</p>
    </header>

    <main class="app-main">
      <div class="app-content">
        <!-- Left Column: Controls and Status -->
        <div class="left-column">
          <!-- Controls Section -->
          <ControlsContainer
            :is-mic-active="isMicActive"
            :can-use-mic="canUseMic"
            :audio-file="audioFile"
            :is-playing="isPlaying"
            :duration="duration"
            :current-time="currentTime"
            :error="error"
            @start-microphone="startMicrophoneWithBump"
            @stop-microphone="stopMicrophone"
            @file-upload="handleFileUploadWithBump"
            @play="onPlay"
            @pause="onPause"
            @stop="onStop"
            @seek="onSeek"
          />

          <!-- Status Display -->
          <StatusDisplay
            :current-source="currentSource"
            :is-initialized="isInitialized"
            :error="error"
          />

          <!-- Visualizer Selector -->
          <VisualizerSelector
            v-model="selectedVisualizer"
          />

          <LayerControls :layer-ids="activeLayerIds()" />

        </div>

        <!-- Right Column: Visualizer -->
        <div class="right-column">
          <LayerHost3D
            :fft="audioData"
            :rms="(rmsData[0] ?? -Infinity) as number"
            :sample-rate="Tone.context.sampleRate"
            :active-layer-ids="activeLayerIds()"
            :source-version="sourceVersion"
          />
        </div>
      </div>
    </main>
  </div>
</template>

<style scoped>
.app {
  min-height: 100vh;
  background: linear-gradient(135deg, #0f0f23 0%, #1a1a2e 100%);
  color: #ffffff;
  font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
}

.app-header {
  text-align: center;
  padding: 2rem 1rem;
  background: rgba(255, 255, 255, 0.05);
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
}

.app-header h1 {
  margin: 0 0 0.5rem 0;
  font-size: 3rem;
  font-weight: 700;
  background: linear-gradient(135deg, #64ffda 0%, #00bcd4 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

.app-header p {
  margin: 0;
  font-size: 1.2rem;
  color: #ccc;
  font-weight: 300;
}

.app-main {
  max-width: 1200px;
  margin: 0 auto;
  padding: 2rem 1rem;
}

.app-content {
  display: flex;
  gap: 2rem;
  align-items: flex-start;
}

.left-column {
  flex: 0 0 400px;
  max-width: 400px;
}

.right-column {
  flex: 1;
  min-width: 0;
}

/* Responsive design for smaller screens */
@media (max-width: 1200px) {
  .app-content {
    flex-direction: column;
    gap: 1rem;
  }
  
  .left-column {
    flex: none;
    max-width: none;
  }
  
  .right-column {
    flex: none;
  }
}
</style>
