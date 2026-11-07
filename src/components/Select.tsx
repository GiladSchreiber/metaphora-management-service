import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

export interface SelectOption {
  value: string
  label: string
}

export function Select({
  value,
  onChange,
  options,
  ariaLabel,
}: {
  value: string
  onChange: (value: string) => void
  options: SelectOption[]
  ariaLabel?: string
}) {
  const [open, setOpen] = useState(false)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLUListElement>(null)
  const selected = options.find(option => option.value === value)

  useLayoutEffect(() => {
    if (!open) return
    const button = buttonRef.current
    const menu = menuRef.current
    if (!button || !menu) return

    function place() {
      const currentButton = buttonRef.current
      const currentMenu = menuRef.current
      if (!currentButton || !currentMenu) return
      const rect = currentButton.getBoundingClientRect()
      const gap = 4
      const height = currentMenu.offsetHeight
      const spaceBelow = window.innerHeight - rect.bottom
      const top = spaceBelow < height + gap && rect.top > spaceBelow
        ? Math.max(8, rect.top - gap - height)
        : rect.bottom + gap
      currentMenu.style.top = `${top}px`
      currentMenu.style.left = `${rect.left}px`
      currentMenu.style.width = `${rect.width}px`
    }

    place()
    window.addEventListener('resize', place)
    window.addEventListener('scroll', place, true)
    return () => {
      window.removeEventListener('resize', place)
      window.removeEventListener('scroll', place, true)
    }
  }, [open, options])

  useEffect(() => {
    if (!open) return
    function onPointer(event: PointerEvent) {
      const target = event.target
      if (!(target instanceof Node)) return
      if (buttonRef.current?.contains(target) || menuRef.current?.contains(target)) return
      setOpen(false)
    }
    function onKey(event: KeyboardEvent) {
      if (event.key !== 'Escape') return
      event.stopPropagation()
      setOpen(false)
    }
    document.addEventListener('pointerdown', onPointer)
    window.addEventListener('keydown', onKey, true)
    return () => {
      document.removeEventListener('pointerdown', onPointer)
      window.removeEventListener('keydown', onKey, true)
    }
  }, [open])

  const menu = open ? createPortal(
    <ul ref={menuRef} className="select-menu" role="listbox">
      {options.map(option => (
        <li key={option.value}>
          <button
            type="button"
            role="option"
            className="select-option"
            aria-selected={option.value === value}
            onClick={() => {
              onChange(option.value)
              setOpen(false)
            }}
          >
            {option.label}
          </button>
        </li>
      ))}
    </ul>,
    document.body,
  ) : null

  return (
    <div className="select">
      <button
        ref={buttonRef}
        type="button"
        className="select-trigger"
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen(current => !current)}
      >
        {selected?.label ?? ''}
      </button>
      {menu}
    </div>
  )
}
