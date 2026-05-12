import { Button as ButtonPrimitive } from "@base-ui/react/button"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "../../lib/utils"

const buttonVariants = cva(
  "group/button inline-flex shrink-0 touch-manipulation items-center justify-center whitespace-nowrap rounded-xl border border-transparent bg-clip-padding text-sm font-semibold tracking-[-0.01em] shadow-sm transition-[background-color,border-color,color,box-shadow,transform] duration-150 ease-out outline-none select-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-white active:not-aria-[haspopup]:scale-[0.98] disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-55 disabled:saturate-50 aria-invalid:border-red-500 aria-invalid:ring-2 aria-invalid:ring-red-500/20 dark:focus-visible:ring-offset-gray-950 dark:aria-invalid:border-red-400 dark:aria-invalid:ring-red-400/30 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default:
          "border-blue-700 bg-blue-600 text-white hover:bg-blue-700 hover:shadow-md focus-visible:ring-blue-500 dark:border-blue-500 dark:bg-blue-500 dark:text-white dark:hover:bg-blue-400 dark:focus-visible:ring-blue-400",
        primary:
          "border-blue-700 bg-blue-600 text-white hover:bg-blue-700 hover:shadow-md focus-visible:ring-blue-500 dark:border-blue-500 dark:bg-blue-500 dark:text-white dark:hover:bg-blue-400 dark:focus-visible:ring-blue-400",
        outline:
          "border-gray-300 bg-white text-gray-700 hover:border-gray-400 hover:bg-gray-50 hover:text-gray-900 focus-visible:ring-gray-400 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200 dark:hover:border-gray-600 dark:hover:bg-gray-800 dark:hover:text-white dark:focus-visible:ring-gray-500",
        secondary:
          "border-gray-200 bg-gray-100 text-gray-700 hover:bg-gray-200 hover:text-gray-900 focus-visible:ring-gray-400 dark:border-gray-800 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700 dark:hover:text-white dark:focus-visible:ring-gray-500",
        ghost:
          "bg-transparent text-gray-600 shadow-none hover:bg-gray-100 hover:text-gray-900 focus-visible:ring-gray-400 dark:text-gray-300 dark:hover:bg-gray-800 dark:hover:text-white dark:focus-visible:ring-gray-500",
        destructive:
          "border-red-700 bg-red-600 text-white hover:bg-red-700 hover:shadow-md focus-visible:ring-red-500 dark:border-red-500 dark:bg-red-500 dark:text-white dark:hover:bg-red-400 dark:focus-visible:ring-red-400",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default:
          "h-11 gap-2 px-5 text-sm has-data-[icon=inline-end]:pr-4 has-data-[icon=inline-start]:pl-4 md:h-10 md:px-4",
        xs: "h-8 gap-1 rounded-lg px-2.5 text-xs has-data-[icon=inline-end]:pr-2 has-data-[icon=inline-start]:pl-2 [&_svg:not([class*='size-'])]:size-3",
        sm: "h-10 gap-1.5 rounded-xl px-4 text-sm has-data-[icon=inline-end]:pr-3 has-data-[icon=inline-start]:pl-3 [&_svg:not([class*='size-'])]:size-3.5",
        lg: "h-12 gap-2.5 px-6 text-base has-data-[icon=inline-end]:pr-5 has-data-[icon=inline-start]:pl-5",
        icon: "size-11 rounded-2xl",
        "icon-xs":
          "size-8 rounded-xl [&_svg:not([class*='size-'])]:size-3",
        "icon-sm":
          "size-10 rounded-xl [&_svg:not([class*='size-'])]:size-4",
        "icon-lg": "size-12 rounded-2xl [&_svg:not([class*='size-'])]:size-5",
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
