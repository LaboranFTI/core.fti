import * as React from "react"
import { Input as InputPrimitive } from "@base-ui/react/input"

import { cn } from "../../lib/utils"

const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<"input">>(
  ({ className, type, ...props }, ref) => {
    return (
      <InputPrimitive
        ref={ref}
        type={type}
        data-slot="input"
        className={cn(
          "h-11 w-full min-w-0 rounded-lg border border-slate-300 bg-white px-3 py-2 text-base text-slate-900 transition-colors outline-none file:inline-flex file:h-6 file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-slate-900 placeholder:text-slate-500 focus-visible:border-fti-blue-600 focus-visible:ring-3 focus-visible:ring-fti-blue-500/20 disabled:pointer-events-none disabled:cursor-not-allowed disabled:bg-slate-100 disabled:opacity-50 aria-invalid:border-red-500 aria-invalid:ring-3 aria-invalid:ring-red-500/20 dark:border-slate-600 dark:bg-slate-900 dark:text-white dark:file:text-white dark:placeholder:text-slate-400 dark:focus-visible:border-fti-blue-300 dark:focus-visible:ring-fti-blue-300/20 dark:disabled:bg-slate-800 md:h-10 md:text-sm",
          className
        )}
        {...props}
      />
    )
  }
)

Input.displayName = "Input"

export { Input }
