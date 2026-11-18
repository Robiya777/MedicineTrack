export interface AvatarProps {
  name: string
  size?: 'sm' | 'md' | 'lg'
}

export function Avatar({ name, size = 'md' }: AvatarProps) {
  const initials = (name || 'B')
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase()

  const sizeClasses = {
    sm: 'h-8 w-8 text-xs',
    md: 'h-9 w-9 text-xs',
    lg: 'h-11 w-11 text-sm',
  }

  return (
    <span
      className={`flex shrink-0 items-center justify-center rounded-full bg-teal-50 font-bold text-primary border border-teal-200/60 ${sizeClasses[size]}`}
      aria-hidden="true"
    >
      {initials}
    </span>
  )
}
