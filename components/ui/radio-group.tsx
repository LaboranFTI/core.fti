import { Circle } from '@phosphor-icons/react';
import * as React from "react"
import { RadioGroup as BaseRadioGroup } from "@base-ui/react/radio-group"
import { Radio as BaseRadio } from "@base-ui/react/radio"

import { cn } from '../../lib/utils'

const RadioGroup = React.forwardRef<
  React.ElementRef<typeof BaseRadioGroup>,
  React.ComponentPropsWithoutRef<typeof BaseRadioGroup>
>(({ className, ...props }, ref) => (
  <BaseRadioGroup
    ref={ref}
    className={cn(
      "grid gap-2",
      className
    )}
    {...props}
  />
))
RadioGroup.displayName = "RadioGroup"

const RadioGroupItem = React.forwardRef<
  React.ElementRef<typeof BaseRadio.Root>,
  React.ComponentPropsWithoutRef<typeof BaseRadio.Root>
>(({ className, ...props }, ref) => (
  <BaseRadio.Root
    ref={ref}
    className={cn(
      "aspect-square h-4 w-4 rounded-full border border-primary text-primary ring-offset-background focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 data-checked:bg-primary data-checked:text-primary-foreground flex items-center justify-center",
      className
    )}
    {...props}
  >
    <BaseRadio.Indicator className="flex items-center justify-center">
      <Circle className="h-2 w-2 fill-current" />
    </BaseRadio.Indicator>
  </BaseRadio.Root>
))
RadioGroupItem.displayName = "RadioGroupItem"

export { RadioGroup, RadioGroupItem }
