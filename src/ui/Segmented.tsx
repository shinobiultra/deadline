import clsx from 'clsx'

type SegmentOption<T extends string> = {
  value: T
  label: string
}

type SegmentedProps<T extends string> = {
  value: T
  onChange: (value: T) => void
  options: Array<SegmentOption<T>>
}

export function Segmented<T extends string>({ value, onChange, options }: SegmentedProps<T>) {
  return (
    <div className="border-cyan-300/25 inline-flex rounded-lg border bg-black/25 p-0.5">
      {options.map((option) => (
        <button
          type="button"
          key={option.value}
          className={clsx(
            'h-10 min-w-[62px] rounded-md px-3 text-xs transition',
            value === option.value
              ? 'to-cyan-500/25 text-cyan-50 bg-gradient-to-r from-emerald-500/35 shadow'
              : 'text-cyan-100/70 hover:text-cyan-100'
          )}
          onClick={() => onChange(option.value)}
        >
          {option.label}
        </button>
      ))}
    </div>
  )
}
