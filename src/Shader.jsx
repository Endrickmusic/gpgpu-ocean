import { OrbitControls, useEnvironment, useTexture } from "@react-three/drei"
import { useRef, useEffect, useMemo, useCallback } from "react"
import { DoubleSide } from "three"
import { useControls } from "leva"

import GPGPUHeightmap from "./Gpgpu.jsx"

export default function Shader() {
  const meshRef = useRef()
  const materialRef = useRef()
  const debugObject = {}

  debugObject.Color = "#4242c1"

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

      <GPGPUHeightmap />
    </>
  )
}
