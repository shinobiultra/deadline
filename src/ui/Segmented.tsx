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
    <div className="inline-flex rounded-lg border border-cyan-300/25 bg-black/25 p-0.5">
      {options.map((option) => (
        <button
          type="button"
          key={option.value}
          className={clsx(
            'rounded-md px-2 py-1 text-xs transition',
            value === option.value
              ? 'bg-gradient-to-r from-emerald-500/35 to-cyan-500/25 text-cyan-50 shadow'
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
