// Shared audio configuration and utilities for audio visualization

// Audio analysis constants
export const AUDIO_CONFIG = {
  // Frequency ranges
  MIN_FREQUENCY: 20,      // Hz - lowest audible frequency
  MAX_FREQUENCY: 8000,    // Hz - reduced from 20kHz for better musical distribution
  
  // Visual layout - Reduced sizes for better proportions
  BASE_RADIUS: 0.4,       // Base radius for circular layout (reduced from 0.8)
  MIN_RADIUS: 0.2,        // Minimum radius when amplitude is 0 (reduced from 0.3)
  MAX_RADIUS: 0.8,        // Maximum radius when amplitude is 1 (reduced from 1.5)
  
  // Point rendering
  MIN_POINT_SIZE: 2.0,    // Minimum point size (reduced from 3.0)
  MAX_POINT_SIZE: 12.0,   // Maximum point size (reduced from 15.0)
  
  // Color and effects
  MIN_ALPHA: 0.8,         // Minimum alpha for visibility
  GLOW_INTENSITY: 0.4,    // Glow effect intensity
  PEAK_HIGHLIGHT: 0.3,    // Peak highlight intensity
  
  // Animation
  TIME_SCALE: 0.1,        // Time-based animation speed
  DECAY_MULTIPLIER: 0.5,  // Decay effect multiplier
} as const

// Mel-scale frequency mapping for human auditory perception
// Lower frequencies get more visual space for musically relevant distribution
export function melScaleToFrequency(melValue: number): number {
  const { MIN_FREQUENCY, MAX_FREQUENCY } = AUDIO_CONFIG
  
  // Convert to Mel scale
  const minMel = 2595 * Math.log10(1 + MIN_FREQUENCY / 700)
  const maxMel = 2595 * Math.log10(1 + MAX_FREQUENCY / 700)
  
  // Interpolate in Mel space
  const mel = minMel + (maxMel - minMel) * melValue
  
  // Convert back to frequency
  return 700 * (Math.pow(10, mel / 2595) - 1)
}

// Calculate visual radius based on amplitude
export function calculateVisualRadius(amplitude: number): number {
  const { MIN_RADIUS, MAX_RADIUS } = AUDIO_CONFIG
  return MIN_RADIUS + (MAX_RADIUS - MIN_RADIUS) * amplitude
}

// Calculate point size based on amplitude
export function calculatePointSize(amplitude: number): number {
  const { MIN_POINT_SIZE, MAX_POINT_SIZE } = AUDIO_CONFIG
  return MIN_POINT_SIZE + (MAX_POINT_SIZE - MIN_POINT_SIZE) * amplitude
}

// Create circular position array for a given number of vertices
export function createCircularPositions(vertexCount: number, radius: number = AUDIO_CONFIG.BASE_RADIUS): Float32Array {
  const positions = new Float32Array(vertexCount * 2)
  
  for (let i = 0; i < vertexCount; i++) {
    const angle = (i / vertexCount) * 2 * Math.PI
    positions[i * 2 + 0] = Math.cos(angle) * radius // x
    positions[i * 2 + 1] = Math.sin(angle) * radius // y
  }
  
  return positions
}

// Create frequency array using mel-scale mapping
export function createFrequencyArray(vertexCount: number): Float32Array {
  const frequencies = new Float32Array(vertexCount)
  
  for (let i = 0; i < vertexCount; i++) {
    const normalizedIndex = i / (vertexCount - 1)
    frequencies[i] = melScaleToFrequency(normalizedIndex)
  }
  
  return frequencies
}

// Buffer layout constants
export const BUFFER_LAYOUT = {
  // Full mode: position(2) + frequency(1) + amplitude(1) + peak(1) = 5 floats per vertex
  FULL_VERTEX_SIZE: 5,
  FULL_POSITION_OFFSET: 0,
  FULL_FREQUENCY_OFFSET: 8,
  FULL_AMPLITUDE_OFFSET: 12,
  FULL_PEAK_OFFSET: 16,
} as const

// Create full frequency data buffer
export function createFullFrequencyBuffer(bufferLength: number): Float32Array {
  const { FULL_VERTEX_SIZE } = BUFFER_LAYOUT
  const vertexCount = bufferLength
  const combinedData = new Float32Array(vertexCount * FULL_VERTEX_SIZE)
  
  // Create circular positions
  const positions = createCircularPositions(vertexCount)
  
  // Create frequency array using mel-scale mapping
  const frequencies = createFrequencyArray(vertexCount)
  
  // Fill the combined buffer
  for (let i = 0; i < vertexCount; i++) {
    const baseIndex = i * FULL_VERTEX_SIZE
    
    // Position (x, y)
    combinedData[baseIndex + 0] = positions[i * 2 + 0]     // x
    combinedData[baseIndex + 1] = positions[i * 2 + 1]     // y
    
    // Frequency (normalized 0-1)
    combinedData[baseIndex + 2] = frequencies[i] / AUDIO_CONFIG.MAX_FREQUENCY
    
    // Amplitude (will be updated with real audio data)
    combinedData[baseIndex + 3] = 0.0
    
    // Peak (will be updated with peak audio data)
    combinedData[baseIndex + 4] = 0.0
  }
  
  return combinedData
}

// Create frequency data buffer for WebGL
export function createFrequencyDataBuffer(bufferLength: number): Float32Array {
  return createFullFrequencyBuffer(bufferLength)
}

// Update full frequency data buffer with real audio data
export function updateFullFrequencyBuffer(
  gl: WebGL2RenderingContext, 
  buffer: WebGLBuffer, 
  frequencyData: Uint8Array, 
  peakData: Uint8Array,
  sensitivity: number = 1.0
): void {
  const { FULL_VERTEX_SIZE } = BUFFER_LAYOUT
  const vertexCount = frequencyData.length
  
  // Create circular positions
  const positions = createCircularPositions(vertexCount)
  
  // Create frequency array using mel-scale mapping
  const frequencies = createFrequencyArray(vertexCount)
  
  // Create the updated buffer data
  const updatedData = new Float32Array(vertexCount * FULL_VERTEX_SIZE)
  
  for (let i = 0; i < vertexCount; i++) {
    const baseIndex = i * FULL_VERTEX_SIZE
    
    // Position (x, y) - same as original
    updatedData[baseIndex + 0] = positions[i * 2 + 0]     // x
    updatedData[baseIndex + 1] = positions[i * 2 + 1]     // y
    
    // Frequency (normalized 0-1)
    updatedData[baseIndex + 2] = frequencies[i] / AUDIO_CONFIG.MAX_FREQUENCY
    
    // Amplitude with sensitivity and non-linear scaling
    const rawAmplitude = frequencyData[i] / 255.0
    const enhancedAmplitude = Math.pow(rawAmplitude, 1.5) * 1.2 // Power curve + boost
    const clampedAmplitude = Math.min(enhancedAmplitude * sensitivity, 1.0)
    updatedData[baseIndex + 3] = clampedAmplitude
    
    // Peak with sensitivity and non-linear scaling
    const rawPeak = peakData[i] / 255.0
    const enhancedPeak = Math.pow(rawPeak, 1.3) * 1.1 // Power curve + boost
    const clampedPeak = Math.min(enhancedPeak * sensitivity, 1.0)
    updatedData[baseIndex + 4] = clampedPeak
  }
  
  // Update the WebGL buffer
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer)
  gl.bufferSubData(gl.ARRAY_BUFFER, 0, updatedData)
}
