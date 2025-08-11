// Basic audio types
export interface AudioSource {
  id: string
  name: string
  type: 'microphone' | 'file'
}

// Audio data for visualization
export interface AudioData {
  frequencies: Float32Array
  waveform: Float32Array
  timestamp: number
}

// Visualization parameters
export interface VisualizerParams {
  sensitivity: number
  decay: number
  smoothing: number
}

// Audio device information
export interface AudioDevice {
  deviceId: string
  label: string
  groupId: string
}
