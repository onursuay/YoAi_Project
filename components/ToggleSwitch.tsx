'use client'

interface ToggleSwitchProps {
  enabled: boolean
  onChange: (e?: React.MouseEvent) => void
  disabled?: boolean
}

export default function ToggleSwitch({ enabled, onChange, disabled = false }: ToggleSwitchProps) {
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation()
        onChange(e)
      }}
      disabled={disabled}
      className={`relative h-5 w-9 shrink-0 rounded-full transition-colors duration-300 ${
        enabled ? 'bg-green-500' : 'bg-gray-300'
      } ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
    >
      <span 
        className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow-sm transition-all duration-300 ${
          enabled ? 'translate-x-4' : 'translate-x-0'
        }`}
      />
    </button>
  )
}
