import { useEffect, useState } from 'react'

type RenderNowState = {
  nowMs: number
  fps: number
  driftMs: number
}

export function useRenderNow(desktopFps = 60, mobileFps = 30): RenderNowState {
  const [state, setState] = useState<RenderNowState>({
    nowMs: 0,
    fps: 0,
    driftMs: 0
  })

  useEffect(() => {
    const coarsePointer = window.matchMedia('(pointer: coarse)').matches
    const lowWidth = window.innerWidth <= 900
    const targetFps = coarsePointer || lowWidth ? mobileFps : desktopFps
    const frameTargetMs = 1000 / targetFps

    let rafId = 0
    let lastFrame = performance.now()
    let lastCommit = lastFrame
    let fpsWindowStart = lastFrame
    let framesInWindow = 0

    const tick = (frameNow: number) => {
      const delta = frameNow - lastFrame
      lastFrame = frameNow
      framesInWindow += 1

      if (frameNow - lastCommit >= frameTargetMs) {
        setState((previous) => ({
          nowMs: Date.now(),
          fps: previous.fps,
          driftMs: Math.abs(delta - frameTargetMs)
        }))
        lastCommit = frameNow
      }

      if (frameNow - fpsWindowStart >= 1000) {
        const fps = Math.round((framesInWindow * 1000) / (frameNow - fpsWindowStart))
        setState((previous) => ({
          nowMs: previous.nowMs,
          fps,
          driftMs: previous.driftMs
        }))
        fpsWindowStart = frameNow
        framesInWindow = 0
      }

      rafId = window.requestAnimationFrame(tick)
    }

    rafId = window.requestAnimationFrame(tick)
    return () => window.cancelAnimationFrame(rafId)
  }, [desktopFps, mobileFps])

  return state
}
