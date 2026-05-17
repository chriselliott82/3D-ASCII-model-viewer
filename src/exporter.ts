import { FFmpeg } from '@ffmpeg/ffmpeg'
import { fetchFile, toBlobURL } from '@ffmpeg/util'
import { toPng } from 'html-to-image'

let ffmpeg: FFmpeg | null = null
let loadingPromise: Promise<FFmpeg> | null = null

async function getFFmpeg(onLog?: (msg: string) => void): Promise<FFmpeg> {
  if (ffmpeg) return ffmpeg
  if (loadingPromise) return loadingPromise

  loadingPromise = (async () => {
    const instance = new FFmpeg()
    if (onLog) instance.on('log', ({ message }) => onLog(message))
    const baseURL = 'https://unpkg.com/@ffmpeg/core@0.12.10/dist/esm'
    await instance.load({
      coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, 'text/javascript'),
      wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm'),
    })
    ffmpeg = instance
    return instance
  })()

  return loadingPromise
}

function findAsciiNode(): HTMLElement | null {
  const wrap = document.querySelector('.canvas-wrap')
  if (!wrap) return null
  return wrap.querySelector('table, pre') as HTMLElement | null
}

function download(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export async function exportPng(bgColor: string) {
  const node = findAsciiNode()
  if (!node) throw new Error('ASCII output not found')
  const dataUrl = await toPng(node, {
    backgroundColor: bgColor,
    pixelRatio: 2,
  })
  const res = await fetch(dataUrl)
  const blob = await res.blob()
  download(blob, `ascii-${Date.now()}.png`)
}

export type RecordProgress = {
  phase: 'capturing' | 'loading-ffmpeg' | 'encoding' | 'done'
  current?: number
  total?: number
  message?: string
}

export async function exportMp4(opts: {
  durationSec: number
  fps: number
  bgColor: string
  onProgress?: (p: RecordProgress) => void
}) {
  const { durationSec, fps, bgColor, onProgress } = opts
  const node = findAsciiNode()
  if (!node) throw new Error('ASCII output not found')

  const total = Math.max(1, Math.round(durationSec * fps))
  const intervalMs = 1000 / fps
  const frames: Uint8Array[] = []

  for (let i = 0; i < total; i++) {
    const t0 = performance.now()
    onProgress?.({ phase: 'capturing', current: i + 1, total })
    const dataUrl = await toPng(node, {
      backgroundColor: bgColor,
      pixelRatio: 1,
      cacheBust: true,
    })
    const res = await fetch(dataUrl)
    const buf = new Uint8Array(await res.arrayBuffer())
    frames.push(buf)
    const elapsed = performance.now() - t0
    const wait = intervalMs - elapsed
    if (wait > 0) await new Promise((r) => setTimeout(r, wait))
  }

  onProgress?.({ phase: 'loading-ffmpeg' })
  const ff = await getFFmpeg((m) => onProgress?.({ phase: 'encoding', message: m }))

  for (let i = 0; i < frames.length; i++) {
    const name = `f${String(i).padStart(5, '0')}.png`
    await ff.writeFile(name, frames[i])
  }

  onProgress?.({ phase: 'encoding' })
  await ff.exec([
    '-framerate', String(fps),
    '-i', 'f%05d.png',
    '-c:v', 'libx264',
    '-pix_fmt', 'yuv420p',
    '-vf', 'pad=ceil(iw/2)*2:ceil(ih/2)*2',
    '-y',
    'out.mp4',
  ])

  const data = await ff.readFile('out.mp4')
  const blob = new Blob([data instanceof Uint8Array ? data : await fetchFile(data)], {
    type: 'video/mp4',
  })
  download(blob, `ascii-${Date.now()}.mp4`)

  for (let i = 0; i < frames.length; i++) {
    const name = `f${String(i).padStart(5, '0')}.png`
    await ff.deleteFile(name).catch(() => {})
  }
  await ff.deleteFile('out.mp4').catch(() => {})

  onProgress?.({ phase: 'done' })
}
