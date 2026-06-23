import { Button as ButtonPrimitive } from "@base-ui/react/button"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "../../lib/utils"

const buttonVariants = cva(
  "group/button inline-flex shrink-0 touch-manipulation items-center justify-center whitespace-nowrap rounded-lg border border-transparent bg-clip-padding text-sm font-semibold shadow-sm transition-[background-color,border-color,color,box-shadow,transform] duration-150 ease-out outline-none select-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-white active:not-aria-[haspopup]:scale-[0.99] disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-55 disabled:saturate-50 aria-invalid:border-red-500 aria-invalid:ring-2 aria-invalid:ring-red-500/20 dark:focus-visible:ring-offset-gray-950 dark:aria-invalid:border-red-400 dark:aria-invalid:ring-red-400/30 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default:
          "border-fti-blue-700 bg-fti-blue-600 text-white hover:bg-fti-blue-700 hover:shadow-md hover:shadow-fti-blue-900/15 focus-visible:ring-fti-blue-500 dark:border-fti-blue-300 dark:bg-fti-blue-300 dark:text-fti-ink dark:hover:bg-fti-blue-200 dark:focus-visible:ring-fti-blue-300",
        primary:
          "border-fti-blue-700 bg-fti-blue-600 text-white hover:bg-fti-blue-700 hover:shadow-md hover:shadow-fti-blue-900/15 focus-visible:ring-fti-blue-500 dark:border-fti-blue-300 dark:bg-fti-blue-300 dark:text-fti-ink dark:hover:bg-fti-blue-200 dark:focus-visible:ring-fti-blue-300",
        outline:
          "border-slate-300 bg-white text-slate-700 hover:border-slate-500 hover:bg-slate-50 hover:text-slate-950 focus-visible:ring-slate-400 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200 dark:hover:border-slate-500 dark:hover:bg-slate-800 dark:hover:text-white dark:focus-visible:ring-slate-500",
        secondary:
          "border-slate-200 bg-slate-100 text-slate-700 hover:bg-slate-200 hover:text-slate-950 focus-visible:ring-slate-400 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700 dark:hover:text-white dark:focus-visible:ring-slate-500",
        ghost:
          "bg-transparent text-slate-600 shadow-none hover:bg-slate-100 hover:text-slate-950 focus-visible:ring-slate-400 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white dark:focus-visible:ring-slate-500",
        destructive:
          "border-red-700 bg-red-600 text-white hover:bg-red-700 hover:shadow-md focus-visible:ring-red-500 dark:border-red-500 dark:bg-red-500 dark:text-white dark:hover:bg-red-400 dark:focus-visible:ring-red-400",
        link: "text-fti-blue-700 underline-offset-4 hover:underline dark:text-fti-blue-300",
      },
      size: {
        default:
          "h-11 gap-2 px-5 text-sm has-data-[icon=inline-end]:pr-4 has-data-[icon=inline-start]:pl-4 md:h-10 md:px-4",
        xs: "h-8 gap-1 rounded-md px-2.5 text-xs has-data-[icon=inline-end]:pr-2 has-data-[icon=inline-start]:pl-2 [&_svg:not([class*='size-'])]:size-3",
        sm: "h-10 gap-1.5 rounded-lg px-4 text-sm has-data-[icon=inline-end]:pr-3 has-data-[icon=inline-start]:pl-3 [&_svg:not([class*='size-'])]:size-3.5",
        lg: "h-12 gap-2.5 px-6 text-base has-data-[icon=inline-end]:pr-5 has-data-[icon=inline-start]:pl-5",
        icon: "size-11 rounded-lg",
        "icon-xs":
          "size-8 rounded-md [&_svg:not([class*='size-'])]:size-3",
        "icon-sm":
          "size-10 rounded-lg [&_svg:not([class*='size-'])]:size-4",
        "icon-lg": "size-12 rounded-lg [&_svg:not([class*='size-'])]:size-5",
      },
    },
    defaultVariants: {
      variant: "primary",
      size: "default",
    },
  }
)

import * as React from "react"

const Button = React.forwardRef<
  React.ElementRef<typeof ButtonPrimitive>,
  React.ComponentPropsWithoutRef<typeof ButtonPrimitive> &
    VariantProps<typeof buttonVariants>
>(({ className, variant = "primary", size = "default", ...props }, ref) => {
  return (
    <ButtonPrimitive
      ref={ref}
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
})
Button.displayName = "Button"

export { Button, buttonVariants }
