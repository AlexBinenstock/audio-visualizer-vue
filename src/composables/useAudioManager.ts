import { ref, onMounted, onUnmounted, nextTick } from 'vue'
import { 
  makeAnalyserFromMic, 
  makeAnalyserFromElement, 
  listAudioInputs,
  type AudioInputDevice 
} from '../lib/audio'

export function useAudioManager() {
  // State
  const currentAnalyser = ref<AnalyserNode | null>(null)
  const currentSource = ref<'microphone' | 'file' | null>(null)
  const audioDevices = ref<AudioInputDevice[]>([])
  const selectedDeviceId = ref('')
  const isMicActive = ref(false)
  const audioFile = ref<File | null>(null)
  const audioElement = ref<HTMLAudioElement>()

  // Load available audio devices
  const loadAudioDevices = async () => {
    try {
      audioDevices.value = await listAudioInputs()
    } catch (error) {
      console.error('Failed to load audio devices:', error)
    }
  }

  // Handle microphone input
  const startMicrophone = async () => {
    try {
      // Stop any existing audio
      stopCurrentAudio()
      
      const deviceId = selectedDeviceId.value || undefined
      const analyser = await makeAnalyserFromMic(deviceId)
      
      currentAnalyser.value = analyser
      currentSource.value = 'microphone'
      isMicActive.value = true
      
      console.log('Microphone activated')
    } catch (error) {
      console.error('Failed to start microphone:', error)
      alert('Failed to access microphone. Please check permissions.')
    }
  }

  // Handle file upload
  const handleFileUpload = (event: Event) => {
    const target = event.target as HTMLInputElement
    const file = target.files?.[0]
    
    if (file && file.type.startsWith('audio/')) {
      audioFile.value = file
      
      // Create object URL for audio element
      const url = URL.createObjectURL(file)
      
      // Wait for next tick to ensure audio element is rendered
      nextTick(() => {
        if (audioElement.value) {
          audioElement.value.src = url
          
          // Set up analyser when audio metadata is loaded
          audioElement.value.addEventListener('loadedmetadata', () => {
            setupFileAnalyser()
          }, { once: true })
          
          // Fallback: also try loadeddata event
          audioElement.value.addEventListener('loadeddata', () => {
            if (!currentAnalyser.value) {
              setupFileAnalyser()
            }
          }, { once: true })
          
          // Error handling
          audioElement.value.addEventListener('error', (e) => {
            console.error('Audio loading error:', e)
            alert(`Failed to load audio file: ${file.name}`)
          })
        }
      })
    }
  }

  // Set up analyser for audio file
  const setupFileAnalyser = () => {
    if (!audioElement.value) return
    
    try {
      // Stop any existing audio
      stopCurrentAudio()
      
      const analyser = makeAnalyserFromElement(audioElement.value)
      currentAnalyser.value = analyser
      currentSource.value = 'file'
      isMicActive.value = false
      
      console.log('Audio file analyser created for:', audioFile.value?.name)
    } catch (error) {
      console.error('Failed to create file analyser:', error)
      alert('Failed to create audio analyser. Please try a different audio file.')
    }
  }

  // Handle device selection change
  const handleDeviceChange = (deviceId: string) => {
    selectedDeviceId.value = deviceId
    if (isMicActive.value) {
      // Restart microphone with new device
      startMicrophone()
    }
  }

  // Stop current audio source
  const stopCurrentAudio = () => {
    if (currentAnalyser.value) {
      // Note: We don't close the AudioContext here as it might be shared
      // The analyser will be garbage collected when replaced
      currentAnalyser.value = null
    }
    currentSource.value = null
    isMicActive.value = false
  }

  // Handle audio element errors
  const handleAudioError = (event: Event) => {
    const target = event.target as HTMLAudioElement
    console.error('Audio element error:', target.error)
    alert(`Audio playback error: ${target.error?.message || 'Unknown error'}`)
  }

  // Lifecycle
  onMounted(() => {
    loadAudioDevices()
  })

  onUnmounted(() => {
    stopCurrentAudio()
  })

  return {
    // State
    currentAnalyser,
    currentSource,
    audioDevices,
    selectedDeviceId,
    isMicActive,
    audioFile,
    audioElement,
    
    // Methods
    startMicrophone,
    handleFileUpload,
    handleDeviceChange,
    stopCurrentAudio,
    handleAudioError,
    loadAudioDevices
  }
}
