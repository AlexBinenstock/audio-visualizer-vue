<script setup lang="ts">
import MicrophoneControls from './MicrophoneControls.vue'
import FileUploadControls from './FileUploadControls.vue'
import VisualizationParameters from './VisualizationParameters.vue'
import type { AudioInputDevice } from '../../lib/audio'

interface Props {
  audioDevices: AudioInputDevice[]
  selectedDeviceId: string
  isMicActive: boolean
  audioFile: File | null
  currentAnalyser: AnalyserNode | null
  audioElement: HTMLAudioElement | undefined
  sensitivity: number
  decay: number
  frequencyMapping: 'logarithmic' | 'linear'
}

interface Emits {
  (e: 'device-change', deviceId: string): void
  (e: 'start-microphone'): void
  (e: 'file-upload', event: Event): void
  (e: 'audio-error', event: Event): void
  (e: 'audio-element-ready', element: HTMLAudioElement): void
  (e: 'sensitivity-change', event: Event): void
  (e: 'decay-change', event: Event): void
  (e: 'frequency-mapping-change', value: 'logarithmic' | 'linear'): void
  (e: 'reset-peaks'): void
  (e: 'test-reactivity'): void
}

defineProps<Props>()
defineEmits<Emits>()
</script>

<template>
  <div class="controls">
    <MicrophoneControls
      :audio-devices="audioDevices"
      :selected-device-id="selectedDeviceId"
      :is-mic-active="isMicActive"
      @device-change="$emit('device-change', $event)"
      @start-microphone="$emit('start-microphone')"
    />
    
    <FileUploadControls
      :audio-file="audioFile"
      :current-analyser="currentAnalyser"
      :audio-element="audioElement"
      @file-upload="$emit('file-upload', $event)"
      @audio-error="$emit('audio-error', $event)"
      @audio-element-ready="$emit('audio-element-ready', $event)"
    />
    
    <VisualizationParameters
      :sensitivity="sensitivity"
      :decay="decay"
      :frequency-mapping="frequencyMapping"
      @sensitivity-change="$emit('sensitivity-change', $event)"
      @decay-change="$emit('decay-change', $event)"
      @frequency-mapping-change="$emit('frequency-mapping-change', $event)"
      @reset-peaks="$emit('reset-peaks')"
      @test-reactivity="$emit('test-reactivity')"
    />
  </div>
</template>

<style scoped>
.controls {
  margin-bottom: 2rem;
}
</style>
