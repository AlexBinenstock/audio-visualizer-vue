/**
 * Audio analysis utilities for the visualizer
 * Provides functions to create analyser nodes from microphone or audio elements
 */

export interface AudioInputDevice {
  deviceId: string;
  label: string;
  kind: string;
}

/**
 * Creates an analyser node from microphone input
 * @param deviceId - Optional device ID for specific microphone
 * @returns Promise resolving to AnalyserNode
 */
export async function makeAnalyserFromMic(deviceId?: string): Promise<AnalyserNode> {
  try {
    // Request microphone access with specific device if provided
    const constraints: MediaStreamConstraints = {
      audio: deviceId ? { deviceId: { exact: deviceId } } : true
    };
    
    const stream = await navigator.mediaDevices.getUserMedia(constraints);
    
    // Create audio context and analyser
    const audioContext = new AudioContext();
    const source = audioContext.createMediaStreamSource(stream);
    const analyser = audioContext.createAnalyser();
    
    // Apply default settings
    analyser.fftSize = 2048;
    analyser.smoothingTimeConstant = 0.8;
    
    // Connect the audio graph
    source.connect(analyser);
    
    return analyser;
  } catch (error) {
    throw new Error(`Failed to access microphone: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Creates an analyser node from an HTML audio/video element
 * @param el - HTMLMediaElement (audio or video)
 * @returns AnalyserNode
 */
export function makeAnalyserFromElement(el: HTMLMediaElement): AnalyserNode {
  try {
    // Check if element is ready
    if (el.readyState === 0) {
      console.warn('Audio element not ready, readyState:', el.readyState)
    }
    
    // Create audio context and analyser
    const audioContext = new AudioContext()
    const source = audioContext.createMediaElementSource(el)
    const analyser = audioContext.createAnalyser()
    
    // Apply default settings
    analyser.fftSize = 2048
    analyser.smoothingTimeConstant = 0.8
    
    // Connect the audio graph
    source.connect(analyser)
    source.connect(audioContext.destination) // Route audio to speakers
    
    console.log('Analyser created successfully for element:', {
      readyState: el.readyState,
      duration: el.duration,
      src: el.src,
      error: el.error
    })
    
    return analyser
  } catch (error) {
    console.error('Error creating analyser from element:', error)
    throw new Error(`Failed to create analyser from audio element: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }
}

/**
 * Lists available audio input devices
 * @returns Promise resolving to array of audio input devices
 */
export async function listAudioInputs(): Promise<AudioInputDevice[]> {
  try {
    // Request permission first
    await navigator.mediaDevices.getUserMedia({ audio: true });
    
    const devices = await navigator.mediaDevices.enumerateDevices();
    
    return devices
      .filter(device => device.kind === 'audioinput')
      .map(device => ({
        deviceId: device.deviceId,
        label: device.label || `Microphone ${device.deviceId.slice(0, 8)}...`,
        kind: device.kind
      }));
  } catch (error) {
    throw new Error(`Failed to enumerate audio devices: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Utility function to resume suspended audio context
 * Useful for browsers that suspend audio context on page load
 */
export async function resumeAudioContext(audioContext: AudioContext): Promise<void> {
  if (audioContext.state === 'suspended') {
    await audioContext.resume();
  }
}

/**
 * Utility function to get the current audio context state
 */
export function getAudioContextState(audioContext: AudioContext): AudioContextState {
  return audioContext.state;
} 