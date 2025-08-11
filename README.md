# Reveri - Vue 3 + TypeScript + Vite

A real-time audio visualizer built with Vue 3, TypeScript, and WebGL2. Features advanced radial visualization with enhanced audio analysis powered by Tone.js, supporting microphone input or audio file upload.

## Features

- 🎤 **Microphone Input**: Real-time audio analysis from any connected microphone
- 📁 **Audio File Support**: Upload and visualize audio files (MP3, WAV, etc.)
- 🎨 **WebGL2 Visualization**: High-performance GPU-accelerated radial visualization
- 🎵 **Enhanced Audio Analysis**: Advanced FFT analysis with Tone.js for better frequency resolution
- ⚙️ **Customizable Parameters**: Adjust sensitivity, decay, and smoothing for different audio styles
- 📱 **Responsive Design**: Works on desktop and mobile devices
- 🚀 **Performance Optimized**: Efficient WebGL2 rendering with 60fps animations

## Getting Started

### Prerequisites

- Node.js 16+ 
- Modern browser with WebGL2 and Web Audio API support

### Installation

```bash
npm install
npm run dev
```

Open [http://localhost:5173](http://localhost:5173) in your browser.

## Audio Input Setup

### Microphone Input
1. Click "Use Microphone" to grant microphone permissions
2. Select your preferred microphone from the dropdown
3. Speak or play music near the microphone

### Audio File Input
1. Click "Choose File" and select an audio file
2. Use the audio player controls to play/pause
3. The visualizer will respond to the audio in real-time

### Windows System Audio Capture

To capture system audio (music from Spotify, YouTube, etc.) on Windows:

#### Option 1: Stereo Mix (Built-in)
1. Right-click the speaker icon in taskbar → "Sounds"
2. Go to "Recording" tab
3. Right-click empty space → "Show Disabled Devices"
4. Enable "Stereo Mix" → Set as default device
5. Select "Stereo Mix" in the visualizer microphone dropdown

#### Option 2: VB-CABLE Virtual Audio Device
1. Download [VB-CABLE Virtual Audio Device](https://vb-audio.com/Cable/)
2. Install and restart your computer
3. Set "CABLE Input" as your default playback device
4. Set "CABLE Output" as your default recording device
5. Select "CABLE Output" in the visualizer microphone dropdown

## Development

### Project Structure
```
src/
├── lib/
│   ├── audio.ts              # Audio input utilities
│   ├── types.ts              # Core type definitions
│   ├── tone-audio-processor.ts # Tone.js audio processing
│   └── webgl/                # WebGL2 rendering system
├── components/
│   ├── visualizer/
│   │   └── VisualizerRadialWebGL.vue  # WebGL2 visualization
│   └── controls/             # Audio and visualization controls
├── composables/
│   └── useToneAudioManager.ts # Enhanced audio management
└── App.vue                   # Main application interface
```

### Key Technologies
- **Vue 3 Composition API** with `<script setup lang="ts">`
- **Tone.js** for advanced audio analysis and processing
- **WebGL2** for high-performance GPU rendering
- **Web Audio API** for real-time audio input
- **TypeScript** for type safety

### Building for Production
```bash
npm run build
npm run preview
```

## Future Enhancements

- Advanced audio effects and filters
- Multiple visualization modes (spectrum, waveform, 3D)
- Recording and export capabilities
- Particle systems and smoke effects
- Real-time audio manipulation

## Browser Support

- Chrome 66+
- Firefox 60+
- Safari 14.1+
- Edge 79+

## License

MIT License - feel free to use this project for learning and development!
