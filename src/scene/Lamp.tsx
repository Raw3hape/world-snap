import { T } from './tokens'

export function Lamp() {
  return (
    <group position={[-1.15, 0.15, -0.55]}>
      <mesh position={[0, -0.85, 0]} castShadow>
        <cylinderGeometry args={[0.045, 0.07, 1.1, 16]} />
        <meshStandardMaterial color={T.brass} metalness={0.85} roughness={0.35} />
      </mesh>
      <mesh position={[0.18, -0.22, 0.12]} rotation={[0.2, 0, -0.7]} castShadow>
        <cylinderGeometry args={[0.018, 0.018, 0.55, 12]} />
        <meshStandardMaterial color={T.brass} metalness={0.85} roughness={0.35} />
      </mesh>
      <group position={[0.42, 0.18, 0.28]} rotation={[0.15, 0.4, -0.35]}>
        <mesh>
          <coneGeometry args={[0.28, 0.34, 24, 1, true]} />
          <meshStandardMaterial color={T.shade} roughness={0.8} side={2} />
        </mesh>
        <mesh rotation={[Math.PI, 0, 0]} position={[0, 0.02, 0]}>
          <coneGeometry args={[0.22, 0.08, 24]} />
          <meshStandardMaterial color={T.lamp} emissive={T.lamp} emissiveIntensity={1.1} />
        </mesh>
        <spotLight
          color={T.lamp}
          intensity={12}
          angle={0.42}
          penumbra={0.7}
          distance={7}
          decay={2}
          castShadow
          shadow-mapSize-width={2048}
          shadow-mapSize-height={2048}
          shadow-bias={-0.0002}
          position={[0, -0.05, 0]}
          target-position={[0.6, -1.4, 1.1]}
        />
        <pointLight color={T.lamp} intensity={1.8} distance={3} decay={2} />
      </group>
    </group>
  )
}
