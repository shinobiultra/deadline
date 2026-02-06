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
        className={`inline-flex h-10 w-16 items-center rounded-full border px-1 transition ${
          checked
            ? 'to-cyan-500/30 border-neon/70 bg-gradient-to-r from-emerald-500/40'
            : 'border-cyan-300/35 bg-black/35'
        }`}
        checked={checked}
        onCheckedChange={onCheckedChange}
      >
        <Switch.Thumb
          className={`bg-cyan-50 block h-7 w-7 rounded-full shadow transition-transform ${
            checked ? 'translate-x-7' : 'translate-x-0'
          }`}
        />
      </Switch.Root>
    </label>
  )
}
