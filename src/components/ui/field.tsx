"use client"

import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import { cn } from "@/lib/utils"

function FieldSet({ className, ...props }: React.ComponentProps<"fieldset">) {
  return <fieldset data-slot="field-set" className={cn("flex flex-col gap-4", className)} {...props} />
}

function FieldLegend({ className, ...props }: React.ComponentProps<"legend">) {
  return <legend data-slot="field-legend" className={cn("mb-3 text-sm font-medium", className)} {...props} />
}

function FieldGroup({ className, ...props }: React.ComponentProps<"div">) {
  return <div data-slot="field-group" className={cn("flex flex-col gap-4", className)} {...props} />
}

const fieldVariants = cva("group/field flex w-full gap-2", {
  variants: {
    orientation: {
      vertical: "flex-col",
      horizontal: "items-center",
      responsive: "flex-col sm:flex-row sm:items-center",
    },
  },
  defaultVariants: { orientation: "vertical" },
})

function Field({ className, orientation, ...props }: React.ComponentProps<"div"> & VariantProps<typeof fieldVariants>) {
  return <div role="group" data-slot="field" data-orientation={orientation} className={cn(fieldVariants({ orientation }), className)} {...props} />
}

function FieldLabel({ className, ...props }: React.ComponentProps<typeof Label>) {
  return <Label data-slot="field-label" className={cn("w-fit", className)} {...props} />
}

function FieldDescription({ className, ...props }: React.ComponentProps<"p">) {
  return <p data-slot="field-description" className={cn("text-xs leading-normal text-muted-foreground", className)} {...props} />
}

function FieldError({ className, children, ...props }: React.ComponentProps<"p">) {
  if (!children) return null
  return <p role="alert" data-slot="field-error" className={cn("text-xs text-destructive", className)} {...props}>{children}</p>
}

function FieldSeparator({ children, className, ...props }: React.ComponentProps<"div">) {
  return <div data-slot="field-separator" className={cn("relative my-1 h-5", className)} {...props}>
    <Separator className="absolute inset-x-0 top-1/2" />
    {children && <span className="relative mx-auto block w-fit bg-background px-2 text-xs text-muted-foreground">{children}</span>}
  </div>
}

export { Field, FieldDescription, FieldError, FieldGroup, FieldLabel, FieldLegend, FieldSeparator, FieldSet }
