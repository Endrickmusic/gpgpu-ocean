import { useMemo, useEffect } from "react"
import {
  ShaderMaterial,
  Vector2,
  WebGLRenderTarget,
  FloatType,
  NearestFilter,
  RGBAFormat,
  Scene,
  OrthographicCamera,
  Mesh,
  PlaneGeometry,
} from "three"
import { useFrame, createPortal, useThree } from "@react-three/fiber"
import { useFBO } from "@react-three/drei"
import { useControls } from "leva"

// Simulation material remains the same as before
const simulationMaterial = {
  vertexShader: `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: `
uniform float uTime;
uniform float uScale;
uniform float uAmplitude;
uniform float uSpeed;

// Hash function by Dave Hoskins
vec2 hash22(vec2 p) {
    vec3 p3 = fract(vec3(p.xyx) * vec3(.1031, .1030, .0973));
    p3 += dot(p3, p3.yzx + 33.33);
    return fract((p3.xx + p3.yz) * p3.zy);
}

float noise2D(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    
    vec2 u = f * f * (3.0 - 2.0 * f);
    
    float a = dot(hash22(i), f);
    float b = dot(hash22(i + vec2(1.0, 0.0)), f - vec2(1.0, 0.0));
    float c = dot(hash22(i + vec2(0.0, 1.0)), f - vec2(0.0, 1.0));
    float d = dot(hash22(i + vec2(1.0, 1.0)), f - vec2(1.0, 1.0));
    
    return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}

float fbm(vec2 p) {
    float value = 0.0;
    float amplitude = uAmplitude;
    float frequency = uScale;
    
    for(int i = 0; i < 6; i++) {
        value += amplitude * noise2D(p * frequency);
        frequency *= 2.0;
        amplitude *= 0.5;
    }
    
    return value;
}

void main() {

    vec2 uv = gl_FragCoord.xy;
    
    // Debug output - comment/uncomment these to test different stages
    
    // Test 1: UV coordinates as colors
    // fragColor = vec4(uv.x, uv.y, 0.0, 1.0);
    
    // Test 2: Animated color
    // fragColor = vec4(sin(time) * 0.5 + 0.5, 0.0, 0.0, 1.0);
    
    // Test 3: Simple checkerboard
    // float checker = mod(floor(uv.x * 10.0) + floor(uv.y * 10.0), 2.0);
    // fragColor = vec4(vec3(checker), 1.0);
    
    // Original code

    float noise = fbm(uv);
    gl_FragColor = vec4(vec3(noise), 1.0);
}
  `,
}

// Change this from const to function to avoid hoisting issues
function createDebugMaterial() {
  return {
    vertexShader: `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform sampler2D heightmap;
      varying vec2 vUv;
      
      void main() {
        vec4 height = texture2D(heightmap, vUv);
        float remappedHeight = height.r * 0.5 + 0.5;
        vec3 color = vec3(remappedHeight);
        
        gl_FragColor = vec4(color, 1.0);
      }
    `,
  }
}

export default function GPGPUHeightmap() {
  const size = 256
  const { gl } = useThree()

  // Scene setup
  const simScene = useMemo(() => new Scene(), [])
  const simCamera = useMemo(
    () => new OrthographicCamera(-1, 1, 1, -1, -1, 1),
    []
  )

  // Create FBO
  const target = useFBO(size, size, {
    minFilter: NearestFilter,
    magFilter: NearestFilter,
    format: RGBAFormat,
    type: FloatType,
    stencilBuffer: false,
  })

  const controls = useControls({
    scale: { value: 5.0, min: 0.0, max: 10.0 },
    amplitude: { value: 1.0, min: 0.0, max: 10.0 },
    speed: { value: 0.5, min: 0.0, max: 1.0 },
  })

  const options = {
    uScale: controls.scale,
    uAmplitude: controls.amplitude,
    uSpeed: controls.speed,
  }

  // Create materials and geometries
  const [simMaterial, debugMaterial, simMesh] = useMemo(() => {
    const sim = new ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uScale: { value: 5.0 },
        uAmplitude: { value: 1.0 },
        uSpeed: { value: 0.5 },
      },
      vertexShader: simulationMaterial.vertexShader,
      fragmentShader: simulationMaterial.fragmentShader,
    })

    const debug = new ShaderMaterial({
      uniforms: {
        heightmap: { value: null },
      },
      vertexShader: createDebugMaterial().vertexShader,
      fragmentShader: createDebugMaterial().fragmentShader,
    })

    // Create simulation mesh
    const mesh = new Mesh(new PlaneGeometry(2, 2), sim)
    simScene.add(mesh)

    return [sim, debug, mesh]
  }, [simScene])

  // Update uniforms when options change
  useEffect(() => {}, [])

  // Update and render simulation
  useFrame((state) => {
    // Update simulation uniforms
    simMaterial.uniforms.uTime.value = state.clock.elapsedTime
    simMaterial.uniforms.uScale.value = options.uScale
    simMaterial.uniforms.uAmplitude.value = options.uAmplitude
    simMaterial.uniforms.uSpeed.value = options.uSpeed

    // Render simulation to FBO
    const currentRenderTarget = gl.getRenderTarget()
    gl.setRenderTarget(target)
    gl.render(simScene, simCamera)
    gl.setRenderTarget(currentRenderTarget)

    // Update debug material with new texture
    debugMaterial.uniforms.heightmap.value = target.texture
  })

  return (
    <>
      {/* Debug visualization */}
      <mesh position={[0, 0, 0]}>
        <planeGeometry args={[2, 2]} />
        <primitive object={debugMaterial} />
      </mesh>
    </>
  )
}
