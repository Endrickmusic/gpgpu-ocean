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
uniform int uOctaves;

float hash(vec2 p) { return fract(1e4 * sin(17.0 * p.x + p.y * 0.1) * (0.1 + abs(sin(p.y * 13.0 + p.x)))); }

float noise(vec2 x) {
	vec2 i = floor(x);
	vec2 f = fract(x);

	// Four corners in 2D of a tile
	float a = hash(i);
	float b = hash(i + vec2(1.0, 0.0));
	float c = hash(i + vec2(0.0, 1.0));
	float d = hash(i + vec2(1.0, 1.0));

	// Simple 2D lerp using smoothstep envelope between the values.
	// return vec3(mix(mix(a, b, smoothstep(0.0, 1.0, f.x)),
	//			mix(c, d, smoothstep(0.0, 1.0, f.x)),
	//			smoothstep(0.0, 1.0, f.y)));

	// Same code, with the clamps in smoothstep and common subexpressions
	// optimized away.
	vec2 u = f * f * (3.0 - 2.0 * f);
	return mix(a, b, u.x) + (c - a) * u.y * (1.0 - u.x) + (d - b) * u.x * u.y;
}

float fbm(vec2 x) {
	float v = 0.0;
	float a = 0.5;
	vec2 shift = vec2(100);
	// Rotate to reduce axial bias
    mat2 rot = mat2(cos(0.5), sin(0.5), -sin(0.5), cos(0.50));
	for (int i = 0; i < uOctaves; ++i) {
		v += a * noise(x);
		x = rot * x * 2.0 + shift;
		a *= 0.5;
	}
	return v;
}


void main() {

    vec2 uv = gl_FragCoord.xy;
    uv *= uScale;
    uv += uTime * uSpeed;
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
    scale: { value: 0.005, min: 0.0, max: 0.15 },
    amplitude: { value: 1.0, min: 0.0, max: 10.0 },
    speed: { value: 0.5, min: 0.0, max: 10.0 },
    octaves: { value: 6, min: 1, max: 10, step: 1 },
  })

  const options = {
    uScale: controls.scale,
    uAmplitude: controls.amplitude,
    uSpeed: controls.speed,
    uOctaves: controls.octaves,
  }

  // Create materials and geometries
  const [simMaterial, debugMaterial, simMesh] = useMemo(() => {
    const sim = new ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uScale: { value: 0.01 },
        uAmplitude: { value: 1.0 },
        uSpeed: { value: 0.5 },
        uOctaves: { value: 6 },
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
    simMaterial.uniforms.uOctaves.value = options.uOctaves

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
