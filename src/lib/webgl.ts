// WebGL2 management and utilities for audio visualization

// Export shader sources for external use
export const RADIAL_VISUALIZER_SHADERS = {
  vertex: '#version 300 es\n' +
    'precision highp float;\n' +
    '\n' +
    'in vec2 a_position;\n' +
    'in float a_frequency;\n' +
    'in float a_amplitude;\n' +
    'in float a_peak;\n' +
    '\n' +
    'out float v_frequency;\n' +
    'out float v_amplitude;\n' +
    'out float v_peak;\n' +
    '\n' +
    'uniform float u_time;\n' +
    'uniform float u_sensitivity;\n' +
    '\n' +
    'void main() {\n' +
    '  v_frequency = a_frequency;\n' +
    '  v_amplitude = a_amplitude * u_sensitivity;\n' +
    '  v_peak = a_peak * u_sensitivity;\n' +
    '  \n' +
    '  // Scale position based on amplitude to make frequency data move off the circle\n' +
    '  float radiusScale = 1.0 + v_amplitude * 2.0; // Amplitude can double the radius\n' +
    '  vec2 scaledPosition = a_position * radiusScale;\n' +
    '  \n' +
    '  gl_Position = vec4(scaledPosition, 0.0, 1.0);\n' +
    '  gl_PointSize = 2.0 + v_amplitude * 10.0; // Reduced base size, better scaling\n' +
    '}',
  fragment: '#version 300 es\n' +
    'precision highp float;\n' +
    '\n' +
    'in float v_frequency;\n' +
    'in float v_amplitude;\n' +
    'in float v_peak;\n' +
    '\n' +
    'uniform float u_time;\n' +
    '\n' +
    'out vec4 fragColor;\n' +
    '\n' +
    'vec3 frequencyToColor(float freq) {\n' +
    '  // Mel-scale frequency mapping for human hearing (20Hz-8kHz)\n' +
    '  float mel = 2595.0 * log(1.0 + freq / 700.0) / log(10.0);\n' +
    '  float maxMel = 2595.0 * log(1.0 + 8000.0 / 700.0) / log(10.0); // ~2595.0 mel\n' +
    '  float normalizedFreq = clamp(mel / maxMel, 0.0, 1.0);\n' +
    '  \n' +
    '  float hue = normalizedFreq;\n' +
    '  hue = mod(hue + u_time * 0.1, 1.0); // Animate over time\n' +
    '  \n' +
    '  // Convert HSV to RGB\n' +
    '  vec3 c = vec3(hue, 1.0, 1.0);\n' +
    '  vec3 rgb = clamp(abs(mod(c.x * 6.0 + vec3(0.0, 4.0, 2.0), 6.0) - 3.0) - 1.0, 0.0, 1.0);\n' +
    '  return rgb * c.z;\n' +
    '}\n' +
    '\n' +
    'void main() {\n' +
    '  // Calculate distance from center of point\n' +
    '  vec2 pointCoord = gl_PointCoord - 0.5;\n' +
    '  float dist = length(pointCoord);\n' +
    '  \n' +
    '  // Create a circular point with soft edges\n' +
    '  float alpha = 1.0 - smoothstep(0.0, 0.5, dist);\n' +
    '  \n' +
    '  // Base color from frequency\n' +
    '  vec3 baseColor = frequencyToColor(v_frequency);\n' +
    '  \n' +
    '  // Enhanced brightness based on amplitude - more dramatic scaling\n' +
    '  float brightness = 0.7 + v_amplitude * 2.0; // Higher base brightness + stronger amplitude boost\n' +
    '  baseColor *= brightness;\n' +
    '  \n' +
    '  // Enhanced peak highlight\n' +
    '  if (v_peak > v_amplitude * 0.7) {\n' +
    '    baseColor += vec3(1.0, 1.0, 1.0) * 0.5; // Stronger peak highlight\n' +
    '  }\n' +
    '  \n' +
    '  // Enhanced glow effect\n' +
    '  float glow = smoothstep(0.4, 0.0, dist) * v_amplitude * 0.6; // Stronger glow\n' +
    '  baseColor += vec3(1.0, 1.0, 1.0) * glow;\n' +
    '  \n' +
    '  // Output final color - ensure good visibility and movement\n' +
    '  float finalAlpha = max(alpha * max(v_amplitude, 0.3), 0.9); // Higher minimum alpha for better visibility\n' +
    '  fragColor = vec4(baseColor, finalAlpha);\n' +
    '}'
}

export class WebGLManager {
  private gl: WebGL2RenderingContext | null = null
  private canvas: HTMLCanvasElement | null = null
  private programs: Map<string, WebGLProgram> = new Map()
  private buffers: Map<string, WebGLBuffer> = new Map()
  private textures: Map<string, WebGLTexture> = new Map()

  init(canvas: HTMLCanvasElement): boolean {
    try {
      this.canvas = canvas
      
      // Try to get WebGL2 context with specific options
      this.gl = canvas.getContext('webgl2', {
        alpha: true,
        antialias: true,
        depth: false,
        stencil: false,
        powerPreference: 'high-performance'
      })
      
      if (!this.gl) {
        return false
      }
      
      // Enable blending for transparency
      this.gl.enable(this.gl.BLEND)
      this.gl.blendFunc(this.gl.SRC_ALPHA, this.gl.ONE_MINUS_SRC_ALPHA)
      
      return true
    } catch (error) {
      return false
    }
  }

  getContext(): WebGL2RenderingContext | null {
    return this.gl
  }

  getCanvas(): HTMLCanvasElement | null {
    return this.canvas
  }

  createProgram(vertexSource: string, fragmentSource: string, name: string): WebGLProgram | null {
    if (!this.gl) return null
    
    try {
      const vertexShader = this.compileShader(this.gl.VERTEX_SHADER, vertexSource)
      const fragmentShader = this.compileShader(this.gl.FRAGMENT_SHADER, fragmentSource)
      
      if (!vertexShader || !fragmentShader) {
        return null
      }
      
      const program = this.gl.createProgram()
      if (!program) return null
      
      this.gl.attachShader(program, vertexShader)
      this.gl.attachShader(program, fragmentShader)
      this.gl.linkProgram(program)
      
      if (!this.gl.getProgramParameter(program, this.gl.LINK_STATUS)) {
        const info = this.gl.getProgramInfoLog(program)
        this.gl.deleteProgram(program)
        return null
      }
      
      this.programs.set(name, program)
      return program
    } catch (error) {
      return null
    }
  }

  private compileShader(type: number, source: string): WebGLShader | null {
    if (!this.gl) return null
    
    try {
      const shader = this.gl.createShader(type)
      if (!shader) return null
      
      this.gl.shaderSource(shader, source)
      this.gl.compileShader(shader)
      
      if (!this.gl.getShaderParameter(shader, this.gl.COMPILE_STATUS)) {
        const info = this.gl.getShaderInfoLog(shader)
        this.gl.deleteShader(shader)
        return null
      }
      
      return shader
    } catch (error) {
      return null
    }
  }

  createBuffer(name: string, data: Float32Array | Uint16Array, usage: number = WebGL2RenderingContext.STATIC_DRAW): WebGLBuffer | null {
    if (!this.gl) return null
    
    try {
      const buffer = this.gl.createBuffer()
      if (!buffer) return null
      
      this.gl.bindBuffer(this.gl.ARRAY_BUFFER, buffer)
      this.gl.bufferData(this.gl.ARRAY_BUFFER, data, usage)
      
      this.buffers.set(name, buffer)
      return buffer
    } catch (error) {
      return null
    }
  }

  getBuffer(name: string): WebGLBuffer | null {
    return this.buffers.get(name) || null
  }

  getProgram(name: string): WebGLProgram | null {
    return this.programs.get(name) || null
  }

  resizeCanvas(width: number, height: number): void {
    if (this.gl && this.canvas) {
      this.gl.viewport(0, 0, width, height)
    }
  }

  clear(): void {
    if (this.gl) {
      this.gl.clear(this.gl.COLOR_BUFFER_BIT)
    }
  }

  dispose(): void {
    if (this.gl) {
      // Clean up programs
      for (const program of this.programs.values()) {
        this.gl.deleteProgram(program)
      }
      this.programs.clear()
      
      // Clean up buffers
      for (const buffer of this.buffers.values()) {
        this.gl.deleteBuffer(buffer)
      }
      this.buffers.clear()
      
      // Clean up textures
      for (const texture of this.textures.values()) {
        this.gl.deleteTexture(texture)
      }
      this.textures.clear()
    }
  }
}

// Re-export audio functions from shared config for backward compatibility
export { 
  createFullFrequencyBuffer as createFrequencyDataBuffer,
  updateFullFrequencyBuffer as updateFrequencyDataBuffer
} from './audio-config'

 