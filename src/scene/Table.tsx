import { ContactShadows } from '@react-three/drei'
import { T, TABLE_Y } from './tokens'

export function Table() {
  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, TABLE_Y, 0.18]} scale={[1, 0.78, 1]} receiveShadow>
        <circleGeometry args={[2.55, 96]} />
        <meshPhysicalMaterial
          color={T.walnut}
          roughness={0.82}
          metalness={0.03}
          clearcoat={0.12}
          clearcoatRoughness={0.62}
          envMapIntensity={0.2}
        />
      </mesh>
      {[0, (Math.PI * 2) / 3, (Math.PI * 4) / 3].map((a) => (
        <mesh
          key={a}
          position={[Math.cos(a) * 0.42, TABLE_Y + 0.04, Math.sin(a) * 0.42]}
          rotation={[0.55, 0, a]}
          castShadow
        >
          <boxGeometry args={[0.18, 0.05, 0.08]} />
          <meshPhysicalMaterial color={T.walnut} roughness={0.5} metalness={0.05} />
        </mesh>
      ))}
      <ContactShadows
        position={[0, TABLE_Y + 0.01, 0.15]}
        opacity={0.45}
        scale={8}
        blur={2.2}
        far={0.8}
        color="#1A100C"
      />
    </group>
  )
}
