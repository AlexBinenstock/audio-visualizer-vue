import { ref, computed } from 'vue'
import * as Tone from 'tone'

export function useSimpleAudioManager() {
  // State
  const isInitialized = ref(false)
  const isMicActive = ref(false)
  const isPlaying = ref(false)
  const currentSource = ref<Tone.Player | Tone.UserMedia | null>(null)
  const audioFile = ref<File | null>(null)
  const error = ref<string | null>(null)
  const duration = ref(0)
  const currentTime = ref(0)
  
  // Timer for updating current time
  let timeUpdateTimer: number | null = null
  
  // Guard to prevent multiple simultaneous startPlayback calls
  let isStartingPlayback = false
  
  // Audio nodes
  let mic: Tone.UserMedia
  let analyser: Tone.Analyser
  let meter: Tone.Meter
  let player: Tone.Player
  
  // Enhanced analyser for better frequency resolution
  let enhancedAnalyser: Tone.Analyser
  // Track current file URL to revoke later
  let fileUrl: string | null = null
  
  // Computed
  const hasAudio = computed(() => currentSource.value !== null)
  const canUseMic = computed(() => isInitialized.value && !isPlaying.value)
  
  // Initialize Tone.js
  const initialize = async () => {
    try {
      await Tone.start()
      
      // Create main analyser for general monitoring
      analyser = new Tone.Analyser({
        type: 'fft',
        size: 256
      })
      
      // Create enhanced analyser with higher resolution for visualization
      enhancedAnalyser = new Tone.Analyser({
        type: 'fft',
        size: 512, // Higher resolution for better frequency analysis
        smoothing: 0.08 // Lower smoothing; we handle smoothing in features.ts
      })
      
      // Create meter for RMS values
      meter = new Tone.Meter(0.2) // Smooth RMS values for better visualization
      
      // Create microphone input
      mic = new Tone.UserMedia()
      
      // Create player for file playback
      player = new Tone.Player()
      
      // Do not route analysers to destination; avoid parallel audio paths
      // Only sources (mic/player) should go to destination
      
      isInitialized.value = true
      error.value = null
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Failed to initialize audio'
      console.error('Audio initialization failed:', err)
    }
  }
  
  // Microphone controls
  const startMicrophone = async () => {
    if (!isInitialized.value) {
      await initialize()
    }
    
    try {
      await mic.open()
      isMicActive.value = true
      currentSource.value = mic
      
      // Connect mic to both analysers and destination
      mic.connect(analyser)
      mic.connect(enhancedAnalyser)
      mic.connect(meter)
      mic.toDestination()
      
      error.value = null
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Failed to start microphone'
      console.error('Microphone start failed:', err)
    }
  }
  
  const stopMicrophone = async () => {
    try {
      await mic.close()
      isMicActive.value = false
      if (currentSource.value === mic) {
        currentSource.value = null
      }
      error.value = null
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Failed to stop microphone'
      console.error('Microphone stop failed:', err)
    }
  }
  
  // File upload and playback
  const handleFileUpload = async (file: File | null) => {
    console.log('handleFileUpload called with:', file?.name || 'null')
    
    if (!isInitialized.value) {
      console.log('Audio not initialized, initializing...')
      await initialize()
    }
    
    try {
      // Stop any current playback
      if (isPlaying.value) {
        console.log('Stopping current playback...')
        await stopPlayback()
      }
      
      if (file) {
        console.log('Loading file:', file.name, 'type:', file.type)
        audioFile.value = file
        
        // Load and play the file
        // Revoke previously loaded URL if any
        if (fileUrl) { URL.revokeObjectURL(fileUrl); fileUrl = null }
        const url = URL.createObjectURL(file)
        fileUrl = url
        console.log('Created object URL:', url)
        
        await player.load(url)
        console.log('Player loaded successfully')
        console.log('Player state:', player.state)
        console.log('Player duration:', player.buffer?.duration)
        
        // Update duration
        duration.value = player.buffer?.duration || 0
        
        currentSource.value = player
        console.log('Set current source to player')
        
        // Ensure player is connected to analyser and destination
        player.connect(analyser)
        player.connect(enhancedAnalyser)
        player.connect(meter)
        console.log('Player connected to analysers')
        // Also connect player directly to destination to ensure audio output
        player.toDestination()
        console.log('Player connected to destination')
        console.log('Player routing: player -> analysers + destination')
        
        // Wait a bit for the buffer to be fully loaded
        await new Promise(resolve => setTimeout(resolve, 100))
        console.log('Player buffer after delay:', !!player.buffer)
        console.log('Player buffer duration:', player.buffer?.duration)
        
        // Ensure player is stopped and ready for playback
        player.stop()
        isPlaying.value = false
        currentTime.value = 0
        
        console.log('File loaded successfully, ready for playback')
        console.log('Player state after setup:', player.state, 'isPlaying:', isPlaying.value)
      } else {
        console.log('Clearing file...')
        // Clear the file
        audioFile.value = null
        currentSource.value = null
        duration.value = 0
        currentTime.value = 0
        
        // Clear time update timer
        if (timeUpdateTimer) {
          clearInterval(timeUpdateTimer)
          timeUpdateTimer = null
        }
        
        if (player) {
          player.stop()
        }
        if (fileUrl) { URL.revokeObjectURL(fileUrl); fileUrl = null }
      }
      
      error.value = null
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Failed to load audio file'
      console.error('File upload failed:', err)
    }
  }
  
  const startPlayback = async () => {
    console.log('🎯 startPlayback called - isStartingPlayback:', isStartingPlayback)
    
    if (isStartingPlayback) {
      console.log('⚠️ startPlayback already in progress, ignoring duplicate call')
      return
    }
    
    isStartingPlayback = true
    
    try {
      console.log('Starting playback...')
      console.log('Current source:', currentSource.value)
      console.log('Is playing:', isPlaying.value)
      
      if (!currentSource.value) {
        console.log('No current source, cannot start playback')
        return
      }
      
      const isPlayerSource = currentSource.value && currentSource.value.constructor?.name?.includes('Player')
      if (isPlayerSource) {
        console.log('Starting player...')
        console.log('Player buffer loaded:', !!player.buffer)
        console.log('Player state before start:', player.state)
        console.log('Audio context state:', Tone.context.state)
        console.log('Player volume:', player.volume.value)
        console.log('Player mute state:', player.mute)
        
        // Ensure audio context is running
        if (Tone.context.state !== 'running') {
          console.log('Starting audio context...')
          await Tone.start()
          console.log('Audio context started, state:', Tone.context.state)
        }
        
        // Start the player from the beginning
        console.log('Calling player.start()...')
        try {
          // Force player to start from beginning
          player.stop()
          await new Promise(resolve => setTimeout(resolve, 50)) // Small delay to ensure stop completes
          
          console.log('Player state after stop:', player.state)
          console.log('About to call player.start()...')
          console.log('Player buffer ready:', !!player.buffer)
          console.log('Player buffer duration:', player.buffer?.duration)
          
          // Try starting with explicit parameters
          player.start(0, 0, duration.value)
          
          console.log('Player.start() completed successfully')
          console.log('Player state after start:', player.state)
          
          // Wait a bit and check state again
          await new Promise(resolve => setTimeout(resolve, 100))
          console.log('Player state after 100ms delay:', player.state)
          
          if (player.state === 'started') {
            console.log('✅ Player successfully started!')
          } else {
            console.log('❌ Player failed to start, state:', player.state)
          }
          
        } catch (startError) {
          console.error('Player.start() failed:', startError)
          throw startError
        }
        
        console.log('Player started successfully')
        
        // Start time update timer
        currentTime.value = 0
        timeUpdateTimer = window.setInterval(() => {
          if (isPlaying.value && duration.value > 0) {
            currentTime.value = Math.min(currentTime.value + 0.1, duration.value)
          }
        }, 100)
      }
      isPlaying.value = true
      console.log('Set isPlaying to true')
      error.value = null
    } catch (err) {
      console.error('Playback start failed with error:', err)
      error.value = err instanceof Error ? err.message : 'Failed to start playback'
    } finally {
      isStartingPlayback = false
      console.log('🎯 startPlayback completed - isStartingPlayback set to false')
    }
  }
  
  const pausePlayback = async () => {
    if (!currentSource.value) return
    
    try {
      const isPlayerSource = currentSource.value && currentSource.value.constructor?.name?.includes('Player')
      if (isPlayerSource) {
        player.stop()
      }
      isPlaying.value = false
      
      // Pause time update timer (don't clear it, just stop updating)
      if (timeUpdateTimer) {
        clearInterval(timeUpdateTimer)
        timeUpdateTimer = null
      }
      
      error.value = null
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Failed to pause playback'
      console.error('Playback pause failed:', err)
    }
  }
  
  const stopPlayback = async () => {
    if (!currentSource.value) return
    
    try {
      const isPlayerSource = currentSource.value && currentSource.value.constructor?.name?.includes('Player')
      if (isPlayerSource) {
        player.stop()
      }
      isPlaying.value = false
      
      // Clear time update timer
      if (timeUpdateTimer) {
        clearInterval(timeUpdateTimer)
        timeUpdateTimer = null
      }
      currentTime.value = 0
      
      error.value = null
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Failed to stop playback'
      console.error('Playback stop failed:', err)
    }
  }
  
  // Get audio data for visualization
  let lastAudioLogTime: number | null = null
  let lastPlayerStateCheck: number | null = null
  const getAudioData = (): { fft: Float32Array, rms: Float32Array } => {
    if (!enhancedAnalyser) {
      console.log('No enhanced analyser available')
      return { fft: new Float32Array(), rms: new Float32Array() }
    }

    // Use enhanced analyser for better frequency resolution
    const fftData = enhancedAnalyser.getValue()
    const rmsValue = meter?.getValue() || 0
    
    // Handle type conversion properly - Tone.js analyser returns number[] or Float32Array
    let fftArray: Float32Array
    let rmsArray: Float32Array
    
    // Convert FFT data to Float32Array
    if (Array.isArray(fftData)) {
      const first = (fftData as any[])[0]
      fftArray = first instanceof Float32Array ? first : new Float32Array(first as ArrayLike<number>)
    } else {
      // If it's already a Float32Array or single number, handle accordingly
      fftArray = fftData as Float32Array
    }
    
    // Convert RMS data to Float32Array - Tone.Meter returns a single number
    const rmsNum = typeof rmsValue === 'number' ? rmsValue : Array.isArray(rmsValue) ? Number(rmsValue[0]) : Number(rmsValue)
    rmsArray = new Float32Array([isFinite(rmsNum) ? rmsNum : 0])
    
    // Throttle logging to once per second
    const now = Date.now()
    if (!lastAudioLogTime || now - lastAudioLogTime > 1000) {
      console.log('Enhanced audio data generated:', fftArray.length, 'samples, first few values:', Array.from(fftArray.slice(0, 5)))
      console.log('RMS data generated:', rmsArray.length, 'samples, first few values:', Array.from(rmsArray.slice(0, 5)))
      
      // Check if we're getting valid audio data
      const hasValidFftData = fftArray.some(value => value > -Infinity && value < Infinity)
      const hasValidRmsData = rmsArray.some(value => value > -Infinity && value < Infinity)
      if (hasValidFftData) {
        console.log('✅ Enhanced analyser receiving valid FFT audio data')
      } else {
        console.log('❌ Enhanced analyser receiving only -Infinity values (no audio signal)')
      }
      if (hasValidRmsData) {
        console.log('✅ Meter receiving valid RMS audio data')
      } else {
        console.log('❌ Meter receiving only -Infinity values (no audio signal)')
      }
      
      lastAudioLogTime = now
    }
    
    // Check player state periodically
    if (player && (now - (lastPlayerStateCheck || 0) > 2000)) {
      console.log('Player state check:', player.state, 'isPlaying:', isPlaying.value, 'currentSource:', currentSource.value)
      
      // Also check if player is actually connected
      const isPlayerSource = currentSource.value && currentSource.value.constructor?.name?.includes('Player')
      if (isPlayerSource) {
        console.log('Player buffer loaded:', !!player.buffer)
        console.log('Player state:', player.state)
      }
      
      lastPlayerStateCheck = now
    }
    
    return { fft: fftArray, rms: rmsArray }
  }
  
  // Cleanup
  const cleanup = () => {
    if (isMicActive.value) {
      stopMicrophone()
    }
    if (isPlaying.value) {
      stopPlayback()
    }
    if (fileUrl) { URL.revokeObjectURL(fileUrl); fileUrl = null }
    audioFile.value = null
    currentSource.value = null
    
    // Clear time update timer
    if (timeUpdateTimer) {
      clearInterval(timeUpdateTimer)
      timeUpdateTimer = null
    }
    currentTime.value = 0
    duration.value = 0
  }
  
  // Handler methods for the UI
  const handlePlay = () => {
    console.log('🎵 handlePlay called')
    console.log('currentSource.value type:', currentSource.value?.constructor?.name)
    console.log('player type:', player?.constructor?.name)
    console.log('!isPlaying.value:', !isPlaying.value)
    console.log('currentSource.value:', currentSource.value)
    console.log('isPlaying.value:', isPlaying.value)
    console.log('currentTime.value:', currentTime.value)
    
                  // Check if current source is a player (simplified check)
              const isPlayerSource = currentSource.value && currentSource.value.constructor?.name?.includes('Player')
    console.log('Calculated isPlayerSource:', isPlayerSource)
    console.log('isPlaying.value:', isPlaying.value)
    console.log('!isPlaying.value:', !isPlaying.value)
    
    if (isPlayerSource && !isPlaying.value) {
      console.log('✅ handlePlay conditions met, proceeding...')
      // If we were paused, we need to restart the player from current time
      if (currentTime.value > 0) {
        console.log('🔄 Resuming from current time:', currentTime.value)
        player.stop()
        player.start(undefined, currentTime.value)
        
        // Restart time update timer
        timeUpdateTimer = window.setInterval(() => {
          if (isPlaying.value && duration.value > 0) {
            currentTime.value = Math.min(currentTime.value + 0.1, duration.value)
          }
        }, 100)
        
        isPlaying.value = true
        error.value = null
      } else {
        console.log('▶️ Starting playback from beginning')
        startPlayback()
      }
    } else {
      console.log('❌ handlePlay conditions not met')
      console.log('isPlayerSource:', isPlayerSource)
      console.log('!isPlaying.value:', !isPlaying.value)
    }
  }
  
  const handlePause = () => {
    const isPlayerSource = currentSource.value && currentSource.value.constructor?.name?.includes('Player')
    if (isPlayerSource && isPlaying.value) {
      pausePlayback()
    }
  }
  
  const handleStop = () => {
    const isPlayerSource = currentSource.value && currentSource.value.constructor?.name?.includes('Player')
    if (isPlayerSource) {
      stopPlayback()
    }
  }
  
  const handleSeek = (time: number) => {
    const isPlayerSource = currentSource.value && currentSource.value.constructor?.name?.includes('Player')
    if (isPlayerSource && player.buffer) {
      // Stop current playback
      player.stop()
      
      // Clear existing timer
      if (timeUpdateTimer) {
        clearInterval(timeUpdateTimer)
        timeUpdateTimer = null
      }
      
      // Seek to new time and start
      player.start(undefined, time)
      currentTime.value = time
      
      // Restart timer if we were playing
      if (isPlaying.value) {
        timeUpdateTimer = window.setInterval(() => {
          if (isPlaying.value && duration.value > 0) {
            currentTime.value = Math.min(currentTime.value + 0.1, duration.value)
          }
        }, 100)
      }
    }
  }
  
  return {
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
    hasAudio,
    canUseMic,
    
    // Methods
    initialize,
    startMicrophone,
    stopMicrophone,
    handleFileUpload,
    startPlayback,
    pausePlayback,
    stopPlayback,
    getAudioData,
    cleanup,
    handlePlay,
    handlePause,
    handleStop,
    handleSeek
  }
}
