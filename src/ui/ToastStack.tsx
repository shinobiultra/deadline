import { AnimatePresence, motion } from 'framer-motion'

export type ToastItem = {
  id: string
  message: string
}

type ToastStackProps = {
  toasts: ToastItem[]
  onDismiss: (id: string) => void
}

export function ToastStack({ toasts, onDismiss }: ToastStackProps) {
  return (
    <div className="pointer-events-none fixed bottom-4 right-4 z-50 flex w-[320px] max-w-[92vw] flex-col gap-2">
      <AnimatePresence>
        {toasts.map((toast) => (
          <motion.button
            key={toast.id}
            className="border-cyan-300/35 text-cyan-100 pointer-events-auto rounded-lg border bg-panel/90 p-3 text-left text-xs shadow-neon"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 12 }}
            onClick={() => onDismiss(toast.id)}
          >
            {toast.message}
          </motion.button>
        ))}
      </AnimatePresence>
    </div>
  )
}
