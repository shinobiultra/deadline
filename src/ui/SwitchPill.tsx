import * as Switch from '@radix-ui/react-switch'

type SwitchPillProps = {
  checked: boolean
  onCheckedChange: (value: boolean) => void
  label: string
  id?: string
}

export function SwitchPill({ checked, onCheckedChange, label, id }: SwitchPillProps) {
  return (
    <label className="flex items-center justify-between gap-2 text-xs" htmlFor={id}>
      <span>{label}</span>
      <Switch.Root
        id={id}
        className={`inline-flex h-7 w-12 items-center rounded-full border px-0.5 transition ${
          checked
            ? 'border-neon/70 bg-gradient-to-r from-emerald-500/40 to-cyan-500/30'
            : 'border-cyan-300/35 bg-black/35'
        }`}
        checked={checked}
        onCheckedChange={onCheckedChange}
      >
        <Switch.Thumb
          className={`block h-5 w-5 rounded-full bg-cyan-50 shadow transition-transform ${
            checked ? 'translate-x-5' : 'translate-x-0'
          }`}
        />
      </Switch.Root>
    </label>
  )
}
