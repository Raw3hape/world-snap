import { useFrame, useThree } from '@react-three/fiber'
import { useEffect, useRef } from 'react'
import {
  Color,
  Group,
  MathUtils,
  Matrix4,
  Mesh,
  PerspectiveCamera,
  Quaternion,
  Raycaster,
  Vector2,
  Vector3,
} from 'three'
import { haptic, playComplete, playMiss, playPickup, playSnap, unlockAudio } from '../audio/synth'
import { dragBus } from '../game/dragBus'
import { evaluateSnap } from '../game/snap'
import { useGame } from '../game/store'
import type { Pack } from '../game/types'
import { latLonToVector3, vector3ToLatLon } from '../geo/sphere'
import { installBridge } from '../test/bridge'
import { CountrySlot } from './CountrySlot'
import { CAM, CAM_DIR, GLOBE_Y, OCEAN_R, R, T, ZOOM, bisque } from './tokens'

const _ndc = new Vector2()
const _ray = new Raycaster()
const _slot = new Vector3()
const _east = new Vector3()
const _north = new Vector3()
const _normal = new Vector3()
const _mat = new Matrix4()
const _quat = new Quaternion()
const _camDir = new Vector3()
const _local = new Vector3()
const _autoQ = new Quaternion()
const _up = new Vector3(0, 1, 0)
const _right = new Vector3()
const _look = new Vector3()
const _camAxis = new Vector3(CAM_DIR[0], CAM_DIR[1], CAM_DIR[2])
const _paper = new Color(T.paper)

type ZoomState = { value: number; target: number; dist: number }

function tangentQuat(worldPoint: Vector3, target: Quaternion) {
  _normal.copy(worldPoint).normalize()
  _east.set(0, 1, 0).cross(_normal)
  if (_east.lengthSq() < 1e-6) _east.set(1, 0, 0).cross(_normal)
  _east.normalize()
  _north.copy(_normal).cross(_east).normalize()
  _mat.makeBasis(_east, _north, _normal)
  return target.setFromRotationMatrix(_mat)
}

function GlobeRig({
  reduced,
  zoom,
  titleFrame,
}: {
  reduced: boolean
  zoom: ZoomState
  titleFrame: boolean
}) {
  const { camera, scene, gl } = useThree()
  const phase = useGame((s) => s.phase)
  useFrame((_, dt) => {
    scene.background = _paper
    gl.setClearColor(_paper, 1)
    const k = reduced ? 1 : 1 - Math.exp(-dt / 0.14)
    zoom.value += (zoom.target - zoom.value) * k
    const u = zoom.value * zoom.value * (3 - 2 * zoom.value)
    const idle =
      phase === 'complete' ? ZOOM.distComplete : titleFrame ? ZOOM.distTitle : ZOOM.distOut
    const zoomed = !titleFrame && phase !== 'complete'
    const goal = MathUtils.lerp(idle, ZOOM.distIn, zoomed ? u : 0)
    zoom.dist += (goal - zoom.dist) * k
    _look.set(0, GLOBE_Y, 0)
    camera.position.copy(_look).addScaledVector(_camAxis, zoom.dist)
    camera.lookAt(_look)
    if (camera instanceof PerspectiveCamera) {
      camera.fov = CAM.fov
      camera.clearViewOffset()
      camera.updateProjectionMatrix()
    }
  })
  return null
}

export function Experience({
  pack,
  reduced,
  titleFrame = false,
}: {
  pack: Pack
  reduced: boolean
  titleFrame?: boolean
}) {
  const { camera, gl } = useThree()
  const globeRef = useRef<Group>(null)
  const oceanRef = useRef<Mesh>(null)
  const spinning = useRef(false)
  const lastPtr = useRef({ x: 0, y: 0 })
  const spinVel = useRef({ yaw: 0, pitch: 0 })
  const zoom = useRef<ZoomState>({
    value: 0,
    target: 0,
    dist: titleFrame ? ZOOM.distTitle : ZOOM.distOut,
  })
  const pointers = useRef(new Map<number, { x: number; y: number }>())
  const pinch = useRef<number | null>(null)
  const drag = useRef({
    id: null as string | null,
    active: false,
    ndc: new Vector2(),
    canSnap: false,
    overGlobe: false,
  })

  const phase = useGame((s) => s.phase)

  useEffect(() => {
    const begin = (id: string, clientX: number, clientY: number) => {
      unlockAudio()
      const g = useGame.getState()
      if (g.phase === 'title') return
      if (g.placed.includes(id)) return
      playPickup(false)
      haptic(4)
      g.setDragging(id)
      drag.current.id = id
      drag.current.active = true
      const rect = gl.domElement.getBoundingClientRect()
      drag.current.ndc.set(
        ((clientX - rect.left) / rect.width) * 2 - 1,
        -((clientY - 8 - rect.top) / rect.height) * 2 + 1,
      )
    }
    dragBus.bind(begin)
    return () => dragBus.bind(null)
  }, [gl])

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

    const moveGhost = (x: number, y: number) => {
      const el = document.getElementById('drag-ghost')
      if (!el) return
      el.style.transform = `translate(${x}px, ${y}px) translate(-50%, -70%)`
    }

    const move = (ev: PointerEvent) => {
      if (pointers.current.has(ev.pointerId)) {
        pointers.current.set(ev.pointerId, { x: ev.clientX, y: ev.clientY })
      }
      if (drag.current.active) moveGhost(ev.clientX, ev.clientY)
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
      drag.current.ndc.copy(ndcFrom(ev, ev.pointerType === 'touch' ? 44 : 8))
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
        playSnap(false)
        haptic([10, 30, 16])
        zoom.current.target = Math.min(1, Math.max(zoom.current.target, 0.4))
        const after = useGame.getState()
        if (after.placed.length >= after.packSize) {
          playComplete(false)
          zoom.current.target = 0
        }
      } else if (drag.current.overGlobe) {
        g.flashMiss()
        playMiss(false)
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
      const ocean = oceanRef.current
      if (!ocean) return
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

    if (dragging && ocean && globe && drag.current.id) {
      const country = pack.countries.find((c) => c.id === drag.current.id)
      if (country) {
        _ray.setFromCamera(drag.current.ndc, camera)
        const hits = _ray.intersectObject(ocean, false)
        const hint = g.hintFor(country.id)
        if (hits[0]) {
          drag.current.overGlobe = true
          const point = hits[0].point
          globe.worldToLocal(_local.copy(point))
          const { lat, lon } = vector3ToLatLon(_local)
          const snap = evaluateSnap(country, lon, lat, hint)
          drag.current.canSnap = snap.canSnap
          const ghost = snap.nearGhost ? country.id : null
          const label = `${country.nameRu}`
          if (g.ghostId !== ghost) g.setGhost(ghost)
          if (g.dragLabel !== label) g.setDragLabel(label)
          if (snap.magnetT > 0) {
            tangentQuat(point, _quat)
            latLonToVector3(country.centroid[1], country.centroid[0], R, _slot)
            globe.localToWorld(_slot)
          }
          if (hint === 'full' && !reduced) {
            latLonToVector3(country.centroid[1], country.centroid[0], 1, _local)
            _camDir.copy(camera.position).normalize()
            _autoQ.setFromUnitVectors(_local, _camDir)
            globe.quaternion.slerp(_autoQ, 1 - Math.exp(-dt / 0.35))
          }
        } else {
          drag.current.overGlobe = false
          drag.current.canSnap = false
          if (g.ghostId) g.setGhost(null)
          if (hint === 'full' && !reduced) {
            latLonToVector3(country.centroid[1], country.centroid[0], 1, _local)
            _camDir.copy(camera.position).normalize()
            _autoQ.setFromUnitVectors(_local, _camDir)
            globe.quaternion.slerp(_autoQ, 1 - Math.exp(-dt / 0.35))
          }
        }
      }
    }

    installBridge({
      camera,
      gl,
      globe: () => globeRef.current,
      pack,
      piecePos: () => null,
    })
  })

  const onGlobeDown = (e: { stopPropagation: () => void; nativeEvent: PointerEvent }) => {
    if (drag.current.active) return
    e.stopPropagation()
    const ev = e.nativeEvent
    pointers.current.set(ev.pointerId, { x: ev.clientX, y: ev.clientY })
    if (pointers.current.size >= 2) {
      spinning.current = false
      const pts = [...pointers.current.values()]
      pinch.current =
        pts[0] && pts[1] ? Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y) : null
      return
    }
    spinning.current = true
    spinVel.current.yaw = 0
    spinVel.current.pitch = 0
    lastPtr.current = { x: ev.clientX, y: ev.clientY }
    document.body.style.cursor = 'grabbing'
  }

  return (
    <>
      <color attach="background" args={[T.paper]} />
      <hemisphereLight args={['#F7F6F3', '#E6E2DC', 0.85]} />
      <directionalLight position={[0.35, 2.1, 2.5]} color="#FFFDF8" intensity={1.15} />
      <directionalLight position={[-1.4, 0.9, -0.7]} color="#EEF1F3" intensity={0.32} />
      <GlobeRig reduced={reduced} zoom={zoom.current} titleFrame={titleFrame} />

      <group ref={globeRef} position={[0, GLOBE_Y, 0]}>
        <mesh onPointerDown={onGlobeDown} visible={false}>
          <sphereGeometry args={[R * 1.13, 16, 12]} />
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
        >
          <sphereGeometry args={[OCEAN_R, 96, 64]} />
          <meshPhysicalMaterial {...bisque} color={T.ocean} />
        </mesh>
        {pack.countries.map((c) => (
          <CountrySlot key={c.id} country={c} radius={R} reduced={reduced} />
        ))}
      </group>
    </>
  )
}
