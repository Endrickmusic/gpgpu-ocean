import { OrbitControls, useEnvironment, useTexture } from "@react-three/drei"
import { useRef, useEffect, useMemo, useCallback } from "react"
import { DoubleSide } from "three"
import { useControls } from "leva"

import ModifiedShader from "./ModifiedShader.jsx"
import GPGPUHeightmap from "./Gpgpu.jsx"

export default function Shader() {
  const meshRef = useRef()
  const materialRef = useRef()
  const debugObject = {}

  debugObject.Color = "#4242c1"

  const options = useMemo(
    () =>
      useControls("Controls", {
        BigElevation: { value: 0.35, min: -5, max: 5, step: 0.001 },
        BigFrequency: { value: 3.4, min: 0, max: 30, step: 0.001 },
        BigSpeed: { value: 0.4, min: -5, max: 5, step: 0.001 },
        NoiseRangeDown: { value: -1.3, min: -1.3, max: 0, step: 0.001 },
        NoiseRangeUp: { value: 1.3, min: 0, max: 1.3, step: 0.001 },
        Wireframe: false,
      }),
    []
  )

  const updateShaderUniforms = useCallback(() => {
    if (!meshRef.current?.material?.userData?.shader) return

    const shader = meshRef.current.material.userData.shader
    shader.uniforms.uBigWaveElevation.value = options.BigElevation
    shader.uniforms.uBigWaveFrequency.value = options.BigFrequency
    shader.uniforms.uBigWaveSpeed.value = options.BigSpeed
    shader.uniforms.uNoiseRangeDown.value = options.NoiseRangeDown
    shader.uniforms.uNoiseRangeUp.value = options.NoiseRangeUp

    materialRef.current.wireframe = options.Wireframe
  }, [options])

  useEffect(() => {
    updateShaderUniforms()
  }, [updateShaderUniforms])

  const envMap = useEnvironment({
    files: "./environments/aerodynamics_workshop_2k.hdr",
  })
  const [normalMap, roughnessMap] = useMemo(
    () =>
      useTexture([
        "./textures/waternormals.jpeg",
        "./textures/SurfaceImperfections003_1K_var1.jpg",
      ]),
    []
  )

  return (
    <>
      <OrbitControls makeDefault />

      <directionalLight position={[0, 2, 0]} intensity={3} />
      <group>
        <mesh
          ref={meshRef}
          scale={1}
          rotation={[Math.PI, 0, 0]}
          position={[0, -1, 0]}
        >
          <planeGeometry args={[2, 2, 256, 256]} />
          <meshStandardMaterial
            ref={materialRef}
            side={DoubleSide}
            wireframe={false}
            roughness={0.05}
            roughnessMap={roughnessMap}
            metalness={0.3}
            envMap={envMap}
            normalMap={normalMap}
            normalScale={0.05}
          />
        </mesh>

        <ModifiedShader options={options} meshRef={meshRef} />
        <GPGPUHeightmap options={options} />
      </group>
    </>
  )
}
