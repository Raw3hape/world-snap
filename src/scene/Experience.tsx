import { Environment } from '@react-three/drei'
import { useFrame, useThree, type ThreeEvent } from '@react-three/fiber'
import { Suspense, useEffect, useMemo, useRef } from 'react'
import {
  Euler,
  Group,
  MathUtils,
  Matrix4,
  Mesh,
  Plane,
  Quaternion,
  Raycaster,
  Vector2,
  Vector3,
} from 'three'
import { haptic, playComplete, playMiss, playPickup, playSnap, unlockAudio } from '../audio/synth'
import { evaluateSnap } from '../game/snap'
import { useGame } from '../game/store'
import type { Pack } from '../game/types'
import { pieceTableLayout } from '../geo/countryGeometry'
import { latLonToVector3, vector3ToLatLon } from '../geo/sphere'
import { CountrySlot } from './CountrySlot'
import { FlagChip } from './FlagChip'
import { Lamp } from './Lamp'
import { Piece, type PiecePose } from './Piece'
import { Table } from './Table'
import { installBridge } from '../test/bridge'
import { R, T, TABLE_Y, bisque, oceanColor } from './tokens'

const tablePlane = new Plane(new Vector3(0, 1, 0), -TABLE_Y)
const _ndc = new Vector2()
const _ray = new Raycaster()
const _hit = new Vector3()
const _slot = new Vector3()
const _east = new Vector3()
const _north = new Vector3()
const _normal = new Vector3()
const _mat = new Matrix4()
const _quat = new Quaternion()
const _euler = new Euler()
const _camDir = new Vector3()
const _local = new Vector3()
const _autoQ = new Quaternion()
const _up = new Vector3(0, 1, 0)
const _right = new Vector3()
const _dest = new Vector3()

function tangentQuat(worldPoint: Vector3, target: Quaternion) {
  _normal.copy(worldPoint).normalize()
  _east.set(0, 1, 0).cross(_normal)
  if (_east.lengthSq() < 1e-6) _east.set(1, 0, 0).cross(_normal)
  _east.normalize()
  _north.copy(_normal).cross(_east).normalize()
  _mat.makeBasis(_east, _north, _normal)
  return target.setFromRotationMatrix(_mat)
}

function homePose(index: number, total: number): PiecePose {
  const { x, z, rot } = pieceTableLayout(index, total)
  return {
    position: new Vector3(x, TABLE_Y + 0.05, z),
    quaternion: new Quaternion().setFromEuler(_euler.set(-Math.PI / 2, rot, 0, 'XYZ')),
    scale: 1,
    opacity: 1,
  }
}

function KeyLight() {
  return (
    <spotLight
      position={[-0.72, 1.72, 0.9]}
      color={T.lamp}
      intensity={18}
      angle={0.5}
      penumbra={0.75}
      distance={9}
      decay={2}
      castShadow
      shadow-mapSize-width={2048}
      shadow-mapSize-height={2048}
      shadow-bias={-0.0002}
    >
      <object3D attach="target" position={[0, -0.1, 0.15]} />
    </spotLight>
  )
}

function Rig({ complete, reduced }: { complete: boolean; reduced: boolean }) {
  const { camera } = useThree()
  useFrame((_, dt) => {
    const dest = complete ? _dest.set(0.28, 2.85, 4.75) : _dest.set(0.18, 2.62, 4.45)
    if (reduced) camera.position.copy(dest)
    else camera.position.lerp(dest, 1 - Math.exp(-dt / (complete ? 0.45 : 0.22)))
    camera.lookAt(0, complete ? -0.22 : -0.58, 0.32)
  })
  return null
}

export function Experience({ pack, reduced }: { pack: Pack; reduced: boolean }) {
  const { camera, gl } = useThree()
  const globeRef = useRef<Group>(null)
  const oceanRef = useRef<Mesh>(null)
  const spinning = useRef(false)
  const lastPtr = useRef({ x: 0, y: 0 })
  const poses = useRef(new Map<string, PiecePose>())
  const drag = useRef({
    id: null as string | null,
    active: false,
    ndc: new Vector2(),
    canSnap: false,
    overGlobe: false,
    clientX: 0,
    clientY: 0,
  })

  const phase = useGame((s) => s.phase)
  const placed = useGame((s) => s.placed)
  const firstId = useGame((s) => s.firstId)
  const isOnTable = useGame((s) => s.isOnTable)
  const muted = useGame((s) => s.muted)

  const visible = useMemo(
    () => pack.countries.filter((c) => isOnTable(c.id)),
    [pack, placed, firstId, phase, isOnTable],
  )

  visible.forEach((c, i) => {
    if (!poses.current.has(c.id)) {
      const home = homePose(i, visible.length)
      poses.current.set(c.id, home)
    }
  })

  useEffect(() => {
    const canvas = gl.domElement
    canvas.style.touchAction = 'none'

    const ndcFrom = (ev: PointerEvent, yLift: number) => {
      const rect = canvas.getBoundingClientRect()
      _ndc.x = ((ev.clientX - rect.left) / rect.width) * 2 - 1
      _ndc.y = -((ev.clientY - yLift - rect.top) / rect.height) * 2 + 1
      return _ndc
    }

    const move = (ev: PointerEvent) => {
      if (spinning.current && globeRef.current && !drag.current.active) {
        const dx = ev.clientX - lastPtr.current.x
        const dy = ev.clientY - lastPtr.current.y
        globeRef.current.rotateOnWorldAxis(_up, (dx * 0.25 * Math.PI) / 180)
        _right.set(1, 0, 0).applyQuaternion(camera.quaternion)
        globeRef.current.rotateOnWorldAxis(_right, (dy * 0.25 * Math.PI) / 180)
        lastPtr.current = { x: ev.clientX, y: ev.clientY }
        return
      }
      if (!drag.current.active) return
      const lift = ev.pointerType === 'touch' ? 44 : 8
      drag.current.ndc.copy(ndcFrom(ev, lift))
      drag.current.clientX = ev.clientX
      drag.current.clientY = ev.clientY
    }

    const up = () => {
      spinning.current = false
      if (!drag.current.active || !drag.current.id) return
      const id = drag.current.id
      const g = useGame.getState()
      if (drag.current.canSnap) {
        g.place(id)
        playSnap(g.muted)
        haptic([10, 30, 16])
        const after = useGame.getState()
        if (after.placed.length >= after.packSize) playComplete(after.muted)
        const pose = poses.current.get(id)
        if (pose) pose.opacity = 0
      } else if (drag.current.overGlobe) {
        g.flashMiss()
        playMiss(g.muted)
        haptic(18)
      }
      g.setDragging(null)
      g.setGhost(null)
      g.setDragLabel(null)
      drag.current.active = false
      drag.current.id = null
      drag.current.canSnap = false
      drag.current.overGlobe = false
    }

    const cancel = () => {
      spinning.current = false
      if (!drag.current.active) return
      const g = useGame.getState()
      g.setDragging(null)
      g.setGhost(null)
      g.setDragLabel(null)
      drag.current.active = false
      drag.current.id = null
    }

    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
    window.addEventListener('pointercancel', cancel)
    window.addEventListener('blur', cancel)
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') cancel()
    }
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
      window.removeEventListener('pointercancel', cancel)
      window.removeEventListener('blur', cancel)
      window.removeEventListener('keydown', onKey)
    }
  }, [camera, gl])

  useFrame((_, dt) => {
    const globe = globeRef.current
    const ocean = oceanRef.current
    const g = useGame.getState()
    const dragging = drag.current.active && drag.current.id

    if (globe && !dragging && !spinning.current && !reduced && (phase === 'title' || phase === 'complete')) {
      globe.rotateY((Math.PI * 2 * dt) / (phase === 'complete' ? 240 : 180))
    }

    visible.forEach((c, i) => {
      const pose = poses.current.get(c.id)
      if (!pose) return
      const home = homePose(i, visible.length)
      const isDrag = drag.current.id === c.id && drag.current.active

      if (isDrag && ocean && globe) {
        _ray.setFromCamera(drag.current.ndc, camera)
        const hits = _ray.intersectObject(ocean, false)
        const hint = g.hintFor(c.id)
        if (hits[0]) {
          drag.current.overGlobe = true
          const point = hits[0].point
          globe.worldToLocal(_local.copy(point))
          const { lat, lon } = vector3ToLatLon(_local)
          const snap = evaluateSnap(c, lon, lat, hint)
          drag.current.canSnap = snap.canSnap
          const ghost = snap.nearGhost ? c.id : null
          const label = hint === 'none' ? null : `${c.nameRu}  ${c.nameEn}`
          if (g.ghostId !== ghost) g.setGhost(ghost)
          if (g.dragLabel !== label) g.setDragLabel(label)

          tangentQuat(point, _quat)
          _hit.copy(point).normalize().multiplyScalar(R + MathUtils.lerp(0.05, 0.008, snap.magnetT))
          if (snap.magnetT > 0) {
            latLonToVector3(c.centroid[1], c.centroid[0], R, _slot)
            globe.localToWorld(_slot)
            const pull = snap.magnetT ** 1.45
            _hit.lerp(_slot.normalize().multiplyScalar(R + 0.008), pull)
            tangentQuat(_slot, _quat)
          }
          const tau = MathUtils.lerp(0.12, 0.038, snap.magnetT)
          const k = 1 - Math.exp(-dt / tau)
          pose.position.lerp(_hit, k)
          pose.quaternion.slerp(_quat, k)
          pose.scale = 1.04
          pose.opacity = 1

          if (hint === 'full' && !reduced) {
            latLonToVector3(c.centroid[1], c.centroid[0], 1, _local)
            _camDir.copy(camera.position).normalize()
            _autoQ.setFromUnitVectors(_local, _camDir)
            globe.quaternion.slerp(_autoQ, 1 - Math.exp(-dt / 0.35))
          }
        } else {
          drag.current.overGlobe = false
          drag.current.canSnap = false
          if (g.ghostId) g.setGhost(null)
          _ray.ray.intersectPlane(tablePlane, _hit)
          if (_hit) {
            _hit.y = TABLE_Y + 0.07
            pose.position.lerp(_hit, 1 - Math.exp(-dt / 0.055))
          }
          pose.quaternion.slerp(home.quaternion, 1 - Math.exp(-dt / 0.08))
          pose.scale = 1.03
          if (g.hintFor(c.id) === 'full' && !reduced) {
            latLonToVector3(c.centroid[1], c.centroid[0], 1, _local)
            _camDir.copy(camera.position).normalize()
            _autoQ.setFromUnitVectors(_local, _camDir)
            globe.quaternion.slerp(_autoQ, 1 - Math.exp(-dt / 0.35))
          }
        }
      } else {
        const k = 1 - Math.exp(-dt / 0.09)
        pose.position.lerp(home.position, k)
        pose.quaternion.slerp(home.quaternion, k)
        pose.scale += (1 - pose.scale) * k
        pose.opacity = 1
      }
    })

    if (typeof window !== 'undefined') {
      installBridge({
        camera,
        gl,
        globe: () => globeRef.current,
        pack,
        piecePos: (id) => poses.current.get(id)?.position ?? null,
      })
    }
  })

  const pickup = (id: string, e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation()
    unlockAudio()
    const g = useGame.getState()
    if (g.phase === 'title' || g.phase === 'complete') return
    if (g.phase === 'choose-first' || !g.firstId) g.chooseFirst(id)
    if (!useGame.getState().isOnTable(id)) return
    g.setDragging(id)
    playPickup(muted)
    haptic(4)
    const ev = e.nativeEvent
    drag.current.id = id
    drag.current.active = true
    const rect = gl.domElement.getBoundingClientRect()
    const lift = ev.pointerType === 'touch' ? 44 : 8
    drag.current.ndc.set(
      ((ev.clientX - rect.left) / rect.width) * 2 - 1,
      -((ev.clientY - lift - rect.top) / rect.height) * 2 + 1,
    )
    try {
      gl.domElement.setPointerCapture(ev.pointerId)
    } catch {
      /* already captured */
    }
  }

  const onGlobeDown = (e: ThreeEvent<PointerEvent>) => {
    if (drag.current.active) return
    e.stopPropagation()
    spinning.current = true
    lastPtr.current = { x: e.nativeEvent.clientX, y: e.nativeEvent.clientY }
  }

  const tutorial = firstId && placed.length === 0
  const tutorialCountry = pack.countries.find((c) => c.id === firstId)
  const chipPos = tutorialCountry
    ? ((): [number, number, number] => {
        const i = visible.findIndex((c) => c.id === tutorialCountry.id)
        const home = homePose(Math.max(i, 0), Math.max(visible.length, 1))
        return [home.position.x + 0.58, TABLE_Y, home.position.z + 0.08]
      })()
    : ([0.5, TABLE_Y, 1.6] as [number, number, number])

  return (
    <>
      <color attach="background" args={[T.ink]} />
      <fogExp2 attach="fog" args={[T.ink, 0.045]} />
      <hemisphereLight args={[T.sky, T.walnut, 0.55]} />
      <directionalLight position={[1.8, 0.6, 1.4]} color={T.lamp} intensity={1.15} />
      <directionalLight position={[1.8, 0.4, -1.6]} color={T.moon} intensity={0.35} />
      <KeyLight />
      <Lamp />
      <Suspense fallback={null}>
        <Environment preset="warehouse" environmentIntensity={0.28} />
      </Suspense>
      <Rig complete={phase === 'complete'} reduced={reduced} />

      <Table />

      <group ref={globeRef}>
        <mesh
          ref={oceanRef}
          onPointerDown={onGlobeDown}
          castShadow
          receiveShadow
        >
          <sphereGeometry args={[R, 96, 64]} />
          <meshPhysicalMaterial {...bisque} color={oceanColor} roughness={0.68} />
        </mesh>
        {pack.countries.map((c) => (
          <CountrySlot key={c.id} country={c} radius={R * 1.003} reduced={reduced} />
        ))}
      </group>

      {visible.map((c) => {
        const pose = poses.current.get(c.id)
        if (!pose) return null
        return (
          <Piece key={c.id} country={c} pose={pose} onPickup={pickup} />
        )
      })}

      {tutorial && tutorialCountry && (
        <FlagChip iso={tutorialCountry.id} position={chipPos} />
      )}
    </>
  )
}
