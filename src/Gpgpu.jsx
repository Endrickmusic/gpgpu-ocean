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
  Vector3,
} from "three"
import { useFrame, createPortal, useThree } from "@react-three/fiber"
import { useFBO } from "@react-three/drei"

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
    uniform float uBigWaveElevation;
    uniform float uBigWaveFrequency;
    uniform float uBigWaveSpeed;
    uniform float uNoiseRangeDown;
    uniform float uNoiseRangeUp;
    varying vec2 vUv;

    //	Classic Perlin 3D Noise 
    vec4 permute(vec4 x){return mod(((x*34.0)+1.0)*x, 289.0);}
    vec4 taylorInvSqrt(vec4 r){return 1.79284291400159 - 0.85373472095314 * r;}
    vec3 fade(vec3 t) {return t*t*t*(t*(t*6.0-15.0)+10.0);}

    float cnoise(vec3 P){
      vec3 Pi0 = floor(P);
      vec3 Pi1 = Pi0 + vec3(1.0);
      Pi0 = mod(Pi0, 289.0);
      Pi1 = mod(Pi1, 289.0);
      vec3 Pf0 = fract(P);
      vec3 Pf1 = Pf0 - vec3(1.0);
      vec4 ix = vec4(Pi0.x, Pi1.x, Pi0.x, Pi1.x);
      vec4 iy = vec4(Pi0.yy, Pi1.yy);
      vec4 iz0 = Pi0.zzzz;
      vec4 iz1 = Pi1.zzzz;

      vec4 ixy = permute(permute(ix) + iy);
      vec4 ixy0 = permute(ixy + iz0);
      vec4 ixy1 = permute(ixy + iz1);

      vec4 gx0 = ixy0 / 7.0;
      vec4 gy0 = fract(floor(gx0) / 7.0) - 0.5;
      gx0 = fract(gx0);
      vec4 gz0 = vec4(0.5) - abs(gx0) - abs(gy0);
      vec4 sz0 = step(gz0, vec4(0.0));
      gx0 -= sz0 * (step(0.0, gx0) - 0.5);
      gy0 -= sz0 * (step(0.0, gy0) - 0.5);

      vec4 gx1 = ixy1 / 7.0;
      vec4 gy1 = fract(floor(gx1) / 7.0) - 0.5;
      gx1 = fract(gx1);
      vec4 gz1 = vec4(0.5) - abs(gx1) - abs(gy1);
      vec4 sz1 = step(gz1, vec4(0.0));
      gx1 -= sz1 * (step(0.0, gx1) - 0.5);
      gy1 -= sz1 * (step(0.0, gy1) - 0.5);

      vec3 g000 = vec3(gx0.x,gy0.x,gz0.x);
      vec3 g100 = vec3(gx0.y,gy0.y,gz0.y);
      vec3 g010 = vec3(gx0.z,gy0.z,gz0.z);
      vec3 g110 = vec3(gx0.w,gy0.w,gz0.w);
      vec3 g001 = vec3(gx1.x,gy1.x,gz1.x);
      vec3 g101 = vec3(gx1.y,gy1.y,gz1.y);
      vec3 g011 = vec3(gx1.z,gy1.z,gz1.z);
      vec3 g111 = vec3(gx1.w,gy1.w,gz1.w);

      vec4 norm0 = taylorInvSqrt(vec4(dot(g000, g000), dot(g010, g010), dot(g100, g100), dot(g110, g110)));
      g000 *= norm0.x;
      g010 *= norm0.y;
      g100 *= norm0.z;
      g110 *= norm0.w;
      vec4 norm1 = taylorInvSqrt(vec4(dot(g001, g001), dot(g011, g011), dot(g101, g101), dot(g111, g111)));
      g001 *= norm1.x;
      g011 *= norm1.y;
      g101 *= norm1.z;
      g111 *= norm1.w;

      float n000 = dot(g000, Pf0);
      float n100 = dot(g100, vec3(Pf1.x, Pf0.yz));
      float n010 = dot(g010, vec3(Pf0.x, Pf1.y, Pf0.z));
      float n110 = dot(g110, vec3(Pf1.xy, Pf0.z));
      float n001 = dot(g001, vec3(Pf0.xy, Pf1.z));
      float n101 = dot(g101, vec3(Pf1.x, Pf0.y, Pf1.z));
      float n011 = dot(g011, vec3(Pf0.x, Pf1.yz));
      float n111 = dot(g111, Pf1);

      vec3 fade_xyz = fade(Pf0);
      vec4 n_z = mix(vec4(n000, n100, n010, n110), vec4(n001, n101, n011, n111), fade_xyz.z);
      vec2 n_yz = mix(n_z.xy, n_z.zw, fade_xyz.y);
      float n_xyz = mix(n_yz.x, n_yz.y, fade_xyz.x); 
      return 2.2 * n_xyz;
    }

    void main() {
      vec3 pos = vec3(vUv.x, 0.0, vUv.y);
      float n = cnoise(pos * uBigWaveFrequency + vec3(uTime * uBigWaveSpeed)) * uBigWaveElevation;
      float noiseArea = sin(smoothstep(uNoiseRangeDown, uNoiseRangeUp, pos.y) * 3.14159);
      float height = n * noiseArea;
      
      // Store height in red channel
      gl_FragColor = vec4(height, 0.0, 0.0, 1.0);
    }
  `,
}

// Rename this to debugMaterialConfig
const debugMaterialConfig = {
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
      // Remap the height value from [-1, 1] to [0, 1] for visualization
      float remappedHeight = height.r * 0.5 + 0.5;
      
      // Create a more visible color gradient
      vec3 color = vec3(remappedHeight);
      
      // Add some color bands for better visualization
      if (remappedHeight < 0.33) {
        color.b = remappedHeight * 3.0;
      } else if (remappedHeight < 0.66) {
        color.g = (remappedHeight - 0.33) * 3.0;
      } else {
        color.r = (remappedHeight - 0.66) * 3.0;
      }
      
      gl_FragColor = vec4(color, 1.0);
    }
  `,
}

const displacementShaders = {
  vertexShader: `
      uniform sampler2D heightmap;
      uniform float uDisplacementStrength;
      
      varying vec2 vUv;
      varying vec3 vNormal;
      varying vec3 vViewPosition;
  
      void main() {
        vUv = uv;
        
        // Sample heightmap
        vec4 heightData = texture2D(heightmap, uv);
        
        // Apply displacement in model space
        vec3 transformed = position;
        transformed.z += heightData.r * uDisplacementStrength;
        
        // Calculate view position and normal
        vec4 mvPosition = modelViewMatrix * vec4(transformed, 1.0);
        vViewPosition = -mvPosition.xyz;
        
        // Calculate normal based on heightmap gradient
        vec2 texelSize = vec2(1.0 / 256.0);
        float left = texture2D(heightmap, uv - vec2(texelSize.x, 0.0)).r;
        float right = texture2D(heightmap, uv + vec2(texelSize.x, 0.0)).r;
        float top = texture2D(heightmap, uv + vec2(0.0, texelSize.y)).r;
        float bottom = texture2D(heightmap, uv - vec2(0.0, texelSize.y)).r;
        
        vec3 normal = normalize(vec3(
          (left - right) * uDisplacementStrength,
          2.0,
          (bottom - top) * uDisplacementStrength
        ));
        
        vNormal = normalMatrix * normal;
        
        gl_Position = projectionMatrix * mvPosition;
      }
    `,
  fragmentShader: `
      uniform vec3 uColor;
      
      varying vec2 vUv;
      varying vec3 vNormal;
      varying vec3 vViewPosition;
  
      void main() {
        // Simple lighting calculation
        vec3 normal = normalize(vNormal);
        vec3 lightPos = vec3(5.0, 5.0, 5.0);
        vec3 lightDir = normalize(lightPos - vViewPosition);
        
        float diffuse = max(dot(normal, lightDir), 0.0);
        float ambient = 0.3;
        
        vec3 color = uColor * (diffuse + ambient);
        
        gl_FragColor = vec4(color, 1.0);
      }
    `,
}

// Add this new shader configuration
const normalVisualizationShaders = {
  vertexShader: `
    uniform sampler2D heightmap;
    uniform float uDisplacementStrength;
    
    varying vec2 vUv;
    varying vec3 vNormal;
    
    void main() {
      vUv = uv;
      
      // Calculate normal based on heightmap gradient
      vec2 texelSize = vec2(1.0 / 256.0);
      float left = texture2D(heightmap, uv - vec2(texelSize.x, 0.0)).r;
      float right = texture2D(heightmap, uv + vec2(texelSize.x, 0.0)).r;
      float top = texture2D(heightmap, uv + vec2(0.0, texelSize.y)).r;
      float bottom = texture2D(heightmap, uv - vec2(0.0, texelSize.y)).r;
      
      // Calculate the derivatives
      float dX = (right - left) * uDisplacementStrength;
      float dY = (top - bottom) * uDisplacementStrength;
      
      // Create the normal vector
      vec3 normal = normalize(vec3(-dX, -dY, 1.0));
      vNormal = normal; // No need for normalMatrix since we're just visualizing
      
      // Just use the original position without displacement
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: `
    varying vec3 vNormal;
    
    void main() {
      vec3 normal = normalize(vNormal);
      vec3 normalColor = normal * 0.5 + 0.5;
      gl_FragColor = vec4(normalColor, 1.0);
    }
  `,
}

export default function GPGPUHeightmap({ options }) {
  const size = 256
  const { gl } = useThree()

  // Scene setup - keep these separate
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

  // Create materials as individual refs
  const simMaterial = useMemo(
    () =>
      new ShaderMaterial({
        uniforms: {
          uTime: { value: 0 },
          uBigWaveElevation: { value: 0 },
          uBigWaveFrequency: { value: 0 },
          uBigWaveSpeed: { value: 0 },
          uNoiseRangeDown: { value: 0 },
          uNoiseRangeUp: { value: 0 },
        },
        vertexShader: simulationMaterial.vertexShader,
        fragmentShader: simulationMaterial.fragmentShader,
      }),
    []
  )

  const debugMaterial = useMemo(
    () =>
      new ShaderMaterial({
        uniforms: {
          heightmap: { value: null },
        },
        vertexShader: debugMaterialConfig.vertexShader,
        fragmentShader: debugMaterialConfig.fragmentShader,
      }),
    []
  )

  const displacementMaterial = useMemo(
    () =>
      new ShaderMaterial({
        uniforms: {
          heightmap: { value: null },
          uDisplacementStrength: { value: 1.0 },
          uColor: { value: new Vector3(0.4, 0.6, 0.8) },
        },
        vertexShader: displacementShaders.vertexShader,
        fragmentShader: displacementShaders.fragmentShader,
      }),
    []
  )

  const normalMaterial = useMemo(
    () =>
      new ShaderMaterial({
        uniforms: {
          heightmap: { value: null },
          uDisplacementStrength: { value: 20.0 },
        },
        vertexShader: normalVisualizationShaders.vertexShader,
        fragmentShader: normalVisualizationShaders.fragmentShader,
      }),
    []
  )

  // Create and add simulation mesh
  const simMesh = useMemo(() => {
    const mesh = new Mesh(new PlaneGeometry(2, 2), simMaterial)
    simScene.add(mesh)
    return mesh
  }, [simScene, simMaterial])

  // Update and render simulation
  useFrame((state) => {
    // Update simulation uniforms
    simMaterial.uniforms.uTime.value = state.clock.elapsedTime
    simMaterial.uniforms.uBigWaveElevation.value = options.BigElevation
    simMaterial.uniforms.uBigWaveFrequency.value = options.BigFrequency
    simMaterial.uniforms.uBigWaveSpeed.value = options.BigSpeed
    simMaterial.uniforms.uNoiseRangeDown.value = options.NoiseRangeDown
    simMaterial.uniforms.uNoiseRangeUp.value = options.NoiseRangeUp

    // Render simulation to FBO
    const currentRenderTarget = gl.getRenderTarget()
    gl.setRenderTarget(target)
    gl.render(simScene, simCamera)
    gl.setRenderTarget(currentRenderTarget)

    // Update debug material with new texture
    debugMaterial.uniforms.heightmap.value = target.texture
    // Update displacement material with new texture
    displacementMaterial.uniforms.heightmap.value = target.texture
    // Update normal visualization material with new texture
    normalMaterial.uniforms.heightmap.value = target.texture
  })

  return (
    <>
      {/* Debug visualization */}
      <mesh position={[2.5, 0, 0]}>
        <planeGeometry args={[2, 2]} />
        <primitive object={debugMaterial} />
      </mesh>
      <mesh position={[-2.5, 0, 0]} rotation={[0, 0, 0]}>
        <planeGeometry args={[2, 2, 256, 256]} />{" "}
        {/* More segments for better displacement */}
        <primitive object={displacementMaterial} />
      </mesh>
      <mesh position={[0, 1.1, 0]} rotation={[0, 0, 0]}>
        <planeGeometry args={[2, 2, 256, 256]} />
        <primitive object={normalMaterial} />
      </mesh>
    </>
  )
}
