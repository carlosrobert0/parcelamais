import { cn } from "cn"

function Eyebrow({ className, children, ...props }: React.ComponentProps<"p">) {
  return (
    <p
      data-slot="eyebrow"
      className={cn("flex items-center gap-3 text-sm font-medium text-primary", className)}
      {...props}
    >
      <span aria-hidden className="h-px w-8 bg-brand-blue" />
      {children}
    </p>
  )
}

export { Eyebrow }
