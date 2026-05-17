import { Canvas, useFrame } from '@react-three/fiber'
import { AsciiRenderer, OrbitControls } from '@react-three/drei'
import { useRef, useState } from 'react'
import type { Group } from 'three'
import { exportPng, exportMp4, type RecordProgress } from './exporter'

type ModelId = 'logo' | 'computer' | 'plant' | 'shiba' | 'crystal'

const MODELS: { id: ModelId; label: string }[] = [
  { id: 'logo', label: 'Logo' },
  { id: 'computer', label: 'Computer' },
  { id: 'plant', label: 'Plant' },
  { id: 'shiba', label: 'Shiba' },
  { id: 'crystal', label: 'Crystal' },
]

const PRESETS = [
  { id: 'classic', chars: ' .:-=+*#%@' },
  { id: 'minimal', chars: ' .-+*#' },
]

const DEFAULTS = {
  model: 'logo' as ModelId,
  resolution: 0.22,
  scale: 1.0,
  preset: 'classic',
  invert: false,
}

const BG = '#3461E5'

function busyLabel(p: RecordProgress): string {
  if (p.phase === 'capturing') return `Frame ${p.current}/${p.total}`
  if (p.phase === 'loading-ffmpeg') return 'Loading ffmpeg…'
  if (p.phase === 'encoding') return 'Encoding…'
  return 'Working…'
}

function Spinner({
  children,
  scale,
}: {
  children: React.ReactNode
  scale: number
}) {
  const ref = useRef<Group>(null)
  useFrame((_, dt) => {
    if (!ref.current) return
    ref.current.rotation.y += dt * 0.4
  })
  return (
    <group ref={ref} scale={scale}>
      {children}
    </group>
  )
}

function ModelGeometry({ id }: { id: ModelId }) {
  const mat = <meshStandardMaterial color="#ffffff" />
  switch (id) {
    case 'logo':
      return (
        <mesh>
          <torusKnotGeometry args={[0.9, 0.32, 160, 24]} />
          {mat}
        </mesh>
      )
    case 'computer':
      return (
        <group>
          <mesh position={[0, 0.3, 0]}>
            <boxGeometry args={[2.2, 1.4, 0.2]} />
            {mat}
          </mesh>
          <mesh position={[0, -0.6, 0.2]}>
            <boxGeometry args={[1.4, 0.1, 0.9]} />
            {mat}
          </mesh>
        </group>
      )
    case 'plant':
      return (
        <group>
          <mesh position={[0, -0.7, 0]}>
            <cylinderGeometry args={[0.5, 0.4, 0.6, 32]} />
            {mat}
          </mesh>
          <mesh position={[0, 0.3, 0]}>
            <sphereGeometry args={[0.8, 24, 24]} />
            {mat}
          </mesh>
          <mesh position={[-0.4, 0.8, 0.2]}>
            <sphereGeometry args={[0.4, 16, 16]} />
            {mat}
          </mesh>
          <mesh position={[0.5, 0.7, -0.1]}>
            <sphereGeometry args={[0.35, 16, 16]} />
            {mat}
          </mesh>
        </group>
      )
    case 'shiba':
      return (
        <group>
          <mesh position={[0, 0, 0]}>
            <sphereGeometry args={[0.9, 32, 32]} />
            {mat}
          </mesh>
          <mesh position={[-0.45, 0.7, 0.3]} rotation={[0, 0, 0.4]}>
            <coneGeometry args={[0.2, 0.5, 16]} />
            {mat}
          </mesh>
          <mesh position={[0.45, 0.7, 0.3]} rotation={[0, 0, -0.4]}>
            <coneGeometry args={[0.2, 0.5, 16]} />
            {mat}
          </mesh>
          <mesh position={[0, -0.15, 0.85]}>
            <sphereGeometry args={[0.18, 16, 16]} />
            {mat}
          </mesh>
        </group>
      )
    case 'crystal':
      return (
        <mesh rotation={[0, 0, 0]}>
          <octahedronGeometry args={[1.3, 0]} />
          {mat}
        </mesh>
      )
  }
}

export default function App() {
  const [model, setModel] = useState<ModelId>(DEFAULTS.model)
  const [resolution, setResolution] = useState(DEFAULTS.resolution)
  const [scale, setScale] = useState(DEFAULTS.scale)
  const [presetId, setPresetId] = useState(DEFAULTS.preset)
  const [invert, setInvert] = useState(DEFAULTS.invert)
  const [duration, setDuration] = useState(3)
  const [busy, setBusy] = useState<RecordProgress | null>(null)

  const onExportPng = async () => {
    try {
      await exportPng(BG)
    } catch (e) {
      console.error(e)
    }
  }

  const onExportMp4 = async () => {
    if (busy) return
    try {
      await exportMp4({
        durationSec: duration,
        fps: 24,
        bgColor: BG,
        onProgress: (p) => setBusy(p),
      })
    } catch (e) {
      console.error(e)
    } finally {
      setBusy(null)
    }
  }

  const preset = PRESETS.find((p) => p.id === presetId) ?? PRESETS[0]

  const reset = () => {
    setModel(DEFAULTS.model)
    setResolution(DEFAULTS.resolution)
    setScale(DEFAULTS.scale)
    setPresetId(DEFAULTS.preset)
    setInvert(DEFAULTS.invert)
  }

  const fg = '#ffffff'
  const bg = BG

  return (
    <div className="app" style={{ background: BG }}>
      <div className="canvas-wrap">
        <Canvas
          camera={{ position: [0, 0, 5], fov: 50 }}
          gl={{ alpha: false, antialias: true }}
          onCreated={({ gl }) => gl.setClearColor('#000000')}
        >
          <color attach="background" args={['#000000']} />
          <ambientLight intensity={0.5} />
          <directionalLight position={[5, 5, 5]} intensity={1.2} />
          <directionalLight position={[-5, -3, -2]} intensity={0.4} />
          <Spinner key={model} scale={scale}>
            <ModelGeometry id={model} />
          </Spinner>
          <OrbitControls enablePan={false} enableZoom={false} />
          <AsciiRenderer
            key={`${preset.id}-${resolution}-${invert}`}
            resolution={resolution}
            characters={preset.chars}
            fgColor={fg}
            bgColor={bg}
            invert={!invert}
          />
        </Canvas>
      </div>

      <nav className="model-list" aria-label="Model selection">
        {MODELS.map((m) => (
          <button
            key={m.id}
            className={model === m.id ? 'active' : ''}
            onClick={() => setModel(m.id)}
          >
            {m.label}
          </button>
        ))}
      </nav>

      <aside className="controls">
        <div className="group">
          <div className="label">Presets</div>
          <div className="presets">
            {PRESETS.map((p) => (
              <button
                key={p.id}
                className={`pill ${presetId === p.id ? 'active' : ''}`}
                onClick={() => setPresetId(p.id)}
              >
                {p.chars.trim()}
              </button>
            ))}
          </div>
        </div>

        <div className="group">
          <div className="label">Resolution</div>
          <input
            type="range"
            min={0.08}
            max={0.4}
            step={0.005}
            value={resolution}
            onChange={(e) => setResolution(parseFloat(e.target.value))}
          />
          <div className="value">{resolution.toFixed(3)}</div>
        </div>

        <div className="group">
          <div className="label">Scale</div>
          <input
            type="range"
            min={0.4}
            max={2}
            step={0.01}
            value={scale}
            onChange={(e) => setScale(parseFloat(e.target.value))}
          />
          <div className="value">{scale.toFixed(2)}</div>
        </div>

        <label className="check">
          <input
            type="checkbox"
            checked={invert}
            onChange={(e) => setInvert(e.target.checked)}
          />
          <span>Invert colors</span>
        </label>

        <div className="group">
          <div className="label">Duration (s)</div>
          <input
            type="range"
            min={1}
            max={10}
            step={1}
            value={duration}
            onChange={(e) => setDuration(parseInt(e.target.value))}
          />
          <div className="value">{duration}s</div>
        </div>

        <div className="export-row">
          <button className="pill" onClick={onExportPng} disabled={!!busy}>
            Export PNG
          </button>
          <button className="pill" onClick={onExportMp4} disabled={!!busy}>
            {busy ? busyLabel(busy) : 'Export MP4'}
          </button>
        </div>

        <button className="reset" onClick={reset} disabled={!!busy}>
          Reset
        </button>
      </aside>
    </div>
  )
}
