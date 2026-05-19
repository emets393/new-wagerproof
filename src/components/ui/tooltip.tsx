import * as React from "react"
import * as TooltipPrimitive from "@radix-ui/react-tooltip"

import { cn } from "@/lib/utils"
import { useTouchPointer } from "@/hooks/useTouchPointer"

type TouchTooltipContextValue = {
  isTouch: boolean
  open: boolean
  setOpen: (open: boolean) => void
}

const TouchTooltipContext = React.createContext<TouchTooltipContextValue | null>(null)

function useTouchTooltipContext() {
  return React.useContext(TouchTooltipContext)
}

const TooltipProvider = ({
  delayDuration = 200,
  ...props
}: React.ComponentPropsWithoutRef<typeof TooltipPrimitive.Provider>) => {
  const isTouch = useTouchPointer()

  return (
    <TooltipPrimitive.Provider
      delayDuration={isTouch ? 0 : delayDuration}
      skipDelayDuration={isTouch ? 0 : undefined}
      {...props}
    />
  )
}

const Tooltip = ({
  children,
  open: openProp,
  onOpenChange,
  delayDuration,
  ...props
}: React.ComponentPropsWithoutRef<typeof TooltipPrimitive.Root>) => {
  const isTouch = useTouchPointer()
  const [open, setOpen] = React.useState(false)

  const isControlled = openProp !== undefined
  const resolvedOpen = isTouch ? (isControlled ? openProp : open) : openProp
  const resolvedOnOpenChange = isTouch
    ? (next: boolean) => {
        if (!isControlled) setOpen(next)
        onOpenChange?.(next)
      }
    : onOpenChange

  const touchProps =
    isTouch && !isControlled
      ? { open: resolvedOpen, onOpenChange: resolvedOnOpenChange, delayDuration: 0 }
      : isTouch
        ? { open: resolvedOpen, onOpenChange: resolvedOnOpenChange, delayDuration: delayDuration ?? 0 }
        : { open: openProp, onOpenChange, delayDuration }

  return (
    <TouchTooltipContext.Provider
      value={{
        isTouch,
        open: Boolean(resolvedOpen),
        setOpen: next => resolvedOnOpenChange?.(next),
      }}
    >
      <TooltipPrimitive.Root {...props} {...touchProps}>
        {children}
      </TooltipPrimitive.Root>
    </TouchTooltipContext.Provider>
  )
}

type TooltipTouchTapMode = "toggle" | "open-then-action"

type TooltipTriggerProps = React.ComponentPropsWithoutRef<typeof TooltipPrimitive.Trigger> & {
  /** On touch: toggle (default) or open tooltip first, then allow the next tap through. */
  touchTapMode?: TooltipTouchTapMode
}

const TooltipTrigger = React.forwardRef<
  React.ElementRef<typeof TooltipPrimitive.Trigger>,
  TooltipTriggerProps
>(({ className, onClick, onClickCapture, touchTapMode = "toggle", ...props }, ref) => {
  const touch = useTouchTooltipContext()

  return (
    <TooltipPrimitive.Trigger
      ref={ref}
      className={cn(touch?.isTouch && "touch-manipulation", className)}
      onClick={onClick}
      onClickCapture={e => {
        onClickCapture?.(e)
        if (!touch?.isTouch) return

        if (touchTapMode === "open-then-action") {
          if (!touch.open) {
            e.preventDefault()
            e.stopPropagation()
            touch.setOpen(true)
          }
          return
        }

        e.preventDefault()
        e.stopPropagation()
        touch.setOpen(!touch.open)
      }}
      {...props}
    />
  )
})
TooltipTrigger.displayName = TooltipPrimitive.Trigger.displayName

const TooltipPortal = TooltipPrimitive.Portal

const TooltipContent = React.forwardRef<
  React.ElementRef<typeof TooltipPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof TooltipPrimitive.Content>
>(({ className, sideOffset = 4, collisionPadding = 8, ...props }, ref) => {
  const touch = useTouchTooltipContext()

  return (
    <TooltipPrimitive.Portal>
      <TooltipPrimitive.Content
        ref={ref}
        sideOffset={sideOffset}
        collisionPadding={collisionPadding}
        onPointerDownOutside={() => {
          if (touch?.isTouch) touch.setOpen(false)
        }}
        onEscapeKeyDown={() => {
          if (touch?.isTouch) touch.setOpen(false)
        }}
        className={cn(
          "z-50 overflow-hidden rounded-md border bg-popover px-3 py-1.5 text-sm text-popover-foreground shadow-md animate-in fade-in-0 zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2",
          touch?.isTouch && "max-w-[min(20rem,calc(100vw-2rem))]",
          className
        )}
        {...props}
      />
    </TooltipPrimitive.Portal>
  )
})
TooltipContent.displayName = TooltipPrimitive.Content.displayName

export { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider, TooltipPortal }
