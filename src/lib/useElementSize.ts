import { useEffect, useState } from 'react'

export type ElementSize = {
  width: number
  height: number
}

export function useElementSize<T extends HTMLElement>(element: T | null): ElementSize {
  const [size, setSize] = useState<ElementSize>({ width: 0, height: 0 })

  useEffect(() => {
    if (!element) {
      return
    }

    const observer = new ResizeObserver((entries) => {
      const rect = entries[0]?.contentRect
      if (!rect) {
        return
      }

      setSize({ width: rect.width, height: rect.height })
    })

    observer.observe(element)
    return () => observer.disconnect()
  }, [element])

  return size
}
