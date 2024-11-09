import { Canvas } from "@react-three/fiber"

import "./index.css"
import Shader from "./Shader.jsx"

function App() {
  return (
    <>
      <Canvas
        camera={{
          position: [0, 0, 6],
          fov: 40,
        }}
      >
        <color attach="background" args={[0x999999]} />
        <Shader />
      </Canvas>
    </>
  )
}

export default App
