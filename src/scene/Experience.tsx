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
import { CAM_DIR, R, T, TABLE_Y, ZOOM, bisque, oceanColor } from './tokens'

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
const _look = new Vector3()
const _camAxis = new Vector3(CAM_DIR[0], CAM_DIR[1], CAM_DIR[2])

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

function GlobeRig({
  complete,
  reduced,
  zoom,
}: {
  complete: boolean
  reduced: boolean
  zoom: { value: number; target: number }
}) {
  const { camera } = useThree()
  useFrame((_, dt) => {
    const k = reduced ? 1 : 1 - Math.exp(-dt / 0.14)
    zoom.value += (zoom.target - zoom.value) * k
    const u = zoom.value * zoom.value * (3 - 2 * zoom.value)
    const dist = MathUtils.lerp(complete ? ZOOM.distComplete : ZOOM.distOut, ZOOM.distIn, u)
    _look.set(
      0,
      MathUtils.lerp(complete ? -0.22 : -0.58, 0.05, u),
      MathUtils.lerp(complete ? 0.28 : 0.32, 0, u),
    )
    camera.position.copy(_look).addScaledVector(_camAxis, dist)
    camera.lookAt(_look)
  })
  return null
}

export function Experience({ pack, reduced }: { pack: Pack; reduced: boolean }) {
  const { camera, gl } = useThree()
  const globeRef = useRef<Group>(null)
  const oceanRef = useRef<Mesh>(null)
  const spinning = useRef(false)
  const lastPtr = useRef({ x: 0, y: 0 })
  const spinVel = useRef({ yaw: 0, pitch: 0 })
  const zoom = useRef({ value: 0, target: 0 })
  const pointers = useRef(new Map<number, { x: number; y: number }>())
  const pinch = useRef<number | null>(null)
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

    const bumpZoom = (delta: number) => {
      zoom.current.target = MathUtils.clamp(zoom.current.target + delta, 0, 1)
    }

    const pinchDistance = () => {
      const pts = [...pointers.current.values()]
      if (pts.length < 2 || !pts[0] || !pts[1]) return null
      return Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y)
    }

    const move = (ev: PointerEvent) => {
      if (pointers.current.has(ev.pointerId)) {
        pointers.current.set(ev.pointerId, { x: ev.clientX, y: ev.clientY })
      }
      if (!drag.current.active && pointers.current.size === 2) {
        spinning.current = false
        const d = pinchDistance()
        if (d != null && pinch.current != null) bumpZoom((d - pinch.current) / 420)
        pinch.current = d
        return
      }
      if (spinning.current && globeRef.current && !drag.current.active) {
        const dx = ev.clientX - lastPtr.current.x
        const dy = ev.clientY - lastPtr.current.y
        const yaw = (dx * 0.38 * Math.PI) / 180
        const pitch = (dy * 0.32 * Math.PI) / 180
        globeRef.current.rotateOnWorldAxis(_up, yaw)
        _right.set(1, 0, 0).applyQuaternion(camera.quaternion)
        globeRef.current.rotateOnWorldAxis(_right, pitch)
        spinVel.current.yaw = yaw * 60
        spinVel.current.pitch = pitch * 60
        lastPtr.current = { x: ev.clientX, y: ev.clientY }
        return
      }
      if (!drag.current.active) return
      const lift = ev.pointerType === 'touch' ? 44 : 8
      drag.current.ndc.copy(ndcFrom(ev, lift))
      drag.current.clientX = ev.clientX
      drag.current.clientY = ev.clientY
    }

    const up = (ev?: PointerEvent) => {
      if (ev) {
        pointers.current.delete(ev.pointerId)
        if (pointers.current.size < 2) pinch.current = null
      } else {
        pointers.current.clear()
        pinch.current = null
      }
      spinning.current = false
      if (!drag.current.active) document.body.style.cursor = ''
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
      pointers.current.clear()
      pinch.current = null
      if (!drag.current.active) return
      const g = useGame.getState()
      g.setDragging(null)
      g.setGhost(null)
      g.setDragLabel(null)
      drag.current.active = false
      drag.current.id = null
    }

    const onCanvasDown = (ev: PointerEvent) => {
      pointers.current.set(ev.pointerId, { x: ev.clientX, y: ev.clientY })
      if (pointers.current.size >= 2) {
        spinning.current = false
        pinch.current = pinchDistance()
      }
    }

    const onWheel = (e: WheelEvent) => {
      if (drag.current.active) return
      e.preventDefault()
      const step = e.deltaMode === 1 ? e.deltaY * 0.06 : e.deltaY * 0.0014
      bumpZoom(-step)
    }

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') cancel()
      if (e.key === '=' || e.key === '+') bumpZoom(0.12)
      if (e.key === '-' || e.key === '_') bumpZoom(-0.12)
    }

    const onDbl = (e: MouseEvent) => {
      if (drag.current.active) return
      const rect = canvas.getBoundingClientRect()
      _ndc.x = ((e.clientX - rect.left) / rect.width) * 2 - 1
      _ndc.y = -((e.clientY - rect.top) / rect.height) * 2 + 1
      _ray.setFromCamera(_ndc, camera)
      const globe = globeRef.current
      const ocean = oceanRef.current
      if (!globe || !ocean) return
      if (_ray.intersectObject(ocean, false).length) zoom.current.target = zoom.current.target > 0.45 ? 0 : 1
    }

    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
    window.addEventListener('pointercancel', cancel)
    window.addEventListener('blur', cancel)
    window.addEventListener('keydown', onKey)
    canvas.addEventListener('pointerdown', onCanvasDown)
    canvas.addEventListener('wheel', onWheel, { passive: false })
    canvas.addEventListener('dblclick', onDbl)
    return () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
      window.removeEventListener('pointercancel', cancel)
      window.removeEventListener('blur', cancel)
      window.removeEventListener('keydown', onKey)
      canvas.removeEventListener('pointerdown', onCanvasDown)
      canvas.removeEventListener('wheel', onWheel)
      canvas.removeEventListener('dblclick', onDbl)
    }
  }, [camera, gl])

  useFrame((_, dt) => {
    const globe = globeRef.current
    const ocean = oceanRef.current
    const g = useGame.getState()
    const dragging = drag.current.active && drag.current.id

    if (globe && !dragging && !spinning.current && pointers.current.size < 2) {
      const damp = Math.exp(-dt / 0.9)
      spinVel.current.yaw *= damp
      spinVel.current.pitch *= damp
      if (Math.abs(spinVel.current.yaw) > 0.002 || Math.abs(spinVel.current.pitch) > 0.002) {
        globe.rotateOnWorldAxis(_up, spinVel.current.yaw * dt)
        _right.set(1, 0, 0).applyQuaternion(camera.quaternion)
        globe.rotateOnWorldAxis(_right, spinVel.current.pitch * dt)
      } else if (!reduced && (phase === 'title' || phase === 'complete')) {
        globe.rotateY((Math.PI * 2 * dt) / (phase === 'complete' ? 240 : 180))
      }
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
    const ev = e.nativeEvent
    pointers.current.set(ev.pointerId, { x: ev.clientX, y: ev.clientY })
    if (pointers.current.size >= 2) {
      spinning.current = false
      pinch.current = (() => {
        const pts = [...pointers.current.values()]
        if (!pts[0] || !pts[1]) return null
        return Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y)
      })()
      return
    }
    spinning.current = true
    spinVel.current.yaw = 0
    spinVel.current.pitch = 0
    lastPtr.current = { x: ev.clientX, y: ev.clientY }
    document.body.style.cursor = 'grabbing'
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
      <GlobeRig complete={phase === 'complete'} reduced={reduced} zoom={zoom.current} />

      <Table />

      <group ref={globeRef}>
        <mesh
          onPointerDown={onGlobeDown}
          visible={false}
        >
          <sphereGeometry args={[R * 1.14, 16, 12]} />
        </mesh>
        <mesh
          ref={oceanRef}
          onPointerDown={onGlobeDown}
          onPointerOver={() => {
            if (!drag.current.active) document.body.style.cursor = 'grab'
          }}
          onPointerOut={() => {
            if (!spinning.current) document.body.style.cursor = ''
          }}
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
