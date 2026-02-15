import html2canvas from 'html2canvas'
import { useCallback, useEffect, useMemo, useState } from 'react'
import type { RefObject } from 'react'

type DebugOverlayProps = {
  enabled: boolean
  rootRef: RefObject<HTMLElement | null>
  onClose: () => void
  perf?: {
    fps: number
    renderDriftMs: number
    terminatorComputeMs: number
  }
}

type DebugEntry = {
  key: string
  rect: {
    x: number
    y: number
    width: number
    height: number
  }
}

function intersects(a: DebugEntry['rect'], b: DebugEntry['rect']) {
  return !(a.x + a.width <= b.x || b.x + b.width <= a.x || a.y + a.height <= b.y || b.y + b.height <= a.y)
}

function iconIntrudesTextArea(
  inputRect: DebugEntry['rect'],
  iconRect: DebugEntry['rect'],
  reservedRightPx = 42
) {
  const textRightEdge = inputRect.x + Math.max(0, inputRect.width - reservedRightPx)
  return iconRect.x < textRightEdge
}

function outsideViewport(
  rect: DebugEntry['rect'],
  viewport: { width: number; height: number },
  margin: number
) {
  return (
    rect.x < margin ||
    rect.y < margin ||
    rect.x + rect.width > viewport.width - margin ||
    rect.y + rect.height > viewport.height - margin
  )
}

function downloadText(filename: string, content: string, type = 'application/json') {
  const blob = new Blob([content], { type })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
}

export function DebugOverlay({ enabled, rootRef, onClose, perf }: DebugOverlayProps) {
  const [entries, setEntries] = useState<DebugEntry[]>([])
  const [warnings, setWarnings] = useState<string[]>([])

  const collect = useCallback(() => {
    const debugElements = Array.from(document.querySelectorAll<HTMLElement>('[data-debug-key]'))
    const nextEntries = debugElements.map((element) => {
      const rect = element.getBoundingClientRect()
      return {
        key: element.dataset.debugKey ?? 'unknown',
        rect: {
          x: Math.round(rect.x),
          y: Math.round(rect.y),
          width: Math.round(rect.width),
          height: Math.round(rect.height)
        }
      }
    })

    const nextWarnings: string[] = []

    const pairs: Array<[string, string]> = [
      ['date-input', 'date-icon-btn'],
      ['time-input', 'time-icon-btn']
    ]

    for (const [aKey, bKey] of pairs) {
      const a = nextEntries.find((entry) => entry.key === aKey)
      const b = nextEntries.find((entry) => entry.key === bKey)
      if (a && b && intersects(a.rect, b.rect) && iconIntrudesTextArea(a.rect, b.rect)) {
        nextWarnings.push(`overlap: ${aKey} intersects ${bKey}`)
      }
    }

    const viewport = { width: window.innerWidth, height: window.innerHeight }
    const cornerHudKeys = ['hud-deadline-chip', 'hud-top-controls', 'hud-countdown', 'hud-layers']
    const cornerHudEntries = nextEntries.filter((entry) => cornerHudKeys.includes(entry.key))

    for (const entry of cornerHudEntries) {
      if (outsideViewport(entry.rect, viewport, 8)) {
        nextWarnings.push(`outside viewport: ${entry.key}`)
      }
    }

    for (let i = 0; i < cornerHudEntries.length; i += 1) {
      for (let j = i + 1; j < cornerHudEntries.length; j += 1) {
        const first = cornerHudEntries[i]
        const second = cornerHudEntries[j]
        if (!first || !second) {
          continue
        }
        if (intersects(first.rect, second.rect)) {
          nextWarnings.push(`overlap: ${first.key} intersects ${second.key}`)
        }
      }
    }

    const interactive = Array.from(
      document.querySelectorAll<HTMLElement>('button,input,select,[role="switch"]')
    ).filter((element) => {
      const rect = element.getBoundingClientRect()
      return rect.width > 0 && rect.height > 0
    })

    for (const element of interactive) {
      const rect = element.getBoundingClientRect()
      if (rect.width < 40 || rect.height < 40) {
        const label =
          element.getAttribute('aria-label') || element.textContent?.trim() || element.tagName.toLowerCase()
        nextWarnings.push(`small hit target: ${label} (${Math.round(rect.width)}x${Math.round(rect.height)})`)
      }
    }

    const textCandidates = Array.from(document.querySelectorAll<HTMLElement>('[data-debug-text]'))
    for (const element of textCandidates) {
      if (element.scrollWidth > element.clientWidth) {
        nextWarnings.push(`clipped text: ${element.dataset.debugText ?? element.textContent?.slice(0, 20)}`)
      }
    }

    setEntries(nextEntries)
    setWarnings(Array.from(new Set(nextWarnings)))
  }, [])

  useEffect(() => {
    if (!enabled) {
      return
    }

    collect()
    const handle = window.setInterval(collect, 1000)
    const onResize = () => collect()
    window.addEventListener('resize', onResize)

    return () => {
      window.clearInterval(handle)
      window.removeEventListener('resize', onResize)
    }
  }, [collect, enabled])

  const summary = useMemo(
    () => ({
      viewport: {
        width: window.innerWidth,
        height: window.innerHeight,
        dpr: window.devicePixelRatio || 1
      },
      entries,
      warnings
    }),
    [entries, warnings]
  )

  if (!enabled) {
    return null
  }

  return (
    <div className="pointer-events-none fixed inset-0 z-[60]">
      {entries.map((entry) => (
        <div
          key={`${entry.key}-${entry.rect.x}-${entry.rect.y}`}
          className="absolute border border-rose-400/70 bg-rose-300/10"
          style={{
            left: entry.rect.x,
            top: entry.rect.y,
            width: entry.rect.width,
            height: entry.rect.height
          }}
        >
          <span className="bg-rose-500/80 px-1 text-[10px] text-white">{entry.key}</span>
        </div>
      ))}

      <div className="border-cyan-300/45 text-cyan-50 pointer-events-auto absolute left-2 top-2 w-[360px] max-w-[95vw] rounded-lg border bg-panel/95 p-3 text-xs shadow-neon">
        <div className="mb-2 flex items-center justify-between">
          <strong>debug layout mode</strong>
          <button type="button" className="btn-ghost px-2 py-1" onClick={onClose}>
            close
          </button>
        </div>

        <div className="mb-2 flex flex-wrap gap-2">
          <button type="button" className="btn-neon px-2 py-1" onClick={collect}>
            refresh
          </button>
          <button
            type="button"
            className="btn-neon px-2 py-1"
            onClick={async () => {
              if (!rootRef.current) return
              const canvas = await html2canvas(rootRef.current, { backgroundColor: null })
              canvas.toBlob((blob) => {
                if (!blob) return
                const url = URL.createObjectURL(blob)
                const link = document.createElement('a')
                link.href = url
                link.download = 'screenshot.png'
                link.click()
                URL.revokeObjectURL(url)
              }, 'image/png')

              downloadText('layout.json', JSON.stringify(summary, null, 2))
            }}
          >
            capture
          </button>
        </div>

        <p className="text-cyan-100/80 text-[11px]">warnings: {warnings.length}</p>
        {perf ? (
          <p className="text-cyan-100/80 mt-1 text-[11px]">
            fps {perf.fps} · render drift {perf.renderDriftMs.toFixed(2)}ms · terminator{' '}
            {perf.terminatorComputeMs.toFixed(2)}ms
          </p>
        ) : null}
        <ul className="max-h-40 overflow-auto text-[11px] text-rose-200">
          {warnings.map((warning) => (
            <li key={warning}>- {warning}</li>
          ))}
        </ul>
      </div>
    </div>
  )
}
