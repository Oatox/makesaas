import * as React from "react"
// Built on Radix Dialog (not Radix AlertDialog, which forbids closing by clicking outside):
// clicking the overlay or pressing Escape closes it. role="alertdialog" keeps the semantics.
import * as DialogPrimitive from "@radix-ui/react-dialog"

import { cn } from "@/lib/utils"
import { buttonVariants } from "@/components/ui/button"
import {
  dialogContentClass,
  dialogDescriptionClass,
  dialogFooterClass,
  dialogHeaderClass,
  dialogMobileSheetClass,
  dialogOverlayClass,
  dialogTitleClass,
} from "@/lib/dialog-styles"

const AlertDialog = DialogPrimitive.Root

const AlertDialogTrigger = DialogPrimitive.Trigger

const AlertDialogPortal = DialogPrimitive.Portal

const AlertDialogOverlay = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Overlay>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Overlay
    className={cn(
      dialogOverlayClass,
      className
    )}
    {...props}
    ref={ref}
  />
))
AlertDialogOverlay.displayName = DialogPrimitive.Overlay.displayName

const AlertDialogContent = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content>
>(({ className, children, ...props }, ref) => (
  <AlertDialogPortal>
    <AlertDialogOverlay />
    <DialogPrimitive.Content
      ref={ref}
      className={cn(
        dialogContentClass,
        className,
        dialogMobileSheetClass
      )}
      role="alertdialog"
      {...props}
    >
      {children}
    </DialogPrimitive.Content>
  </AlertDialogPortal>
))
AlertDialogContent.displayName = DialogPrimitive.Content.displayName

const AlertDialogHeader = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    // No close button in confirmation dialogs: drop the right padding reserved for it,
    // so content (inputs...) spans the full width like the footer buttons.
    className={cn(
      dialogHeaderClass,
      "pr-0",
      className
    )}
    {...props}
  />
)
AlertDialogHeader.displayName = "AlertDialogHeader"

const AlertDialogFooter = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn(
      dialogFooterClass,
      className
    )}
    {...props}
  />
)
AlertDialogFooter.displayName = "AlertDialogFooter"

const AlertDialogTitle = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Title>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Title
    ref={ref}
    className={cn(dialogTitleClass, className)}
    {...props}
  />
))
AlertDialogTitle.displayName = DialogPrimitive.Title.displayName

const AlertDialogDescription = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Description>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Description>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Description
    ref={ref}
    className={cn(dialogDescriptionClass, className)}
    {...props}
  />
))
AlertDialogDescription.displayName =
  DialogPrimitive.Description.displayName

const AlertDialogAction = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Close>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Close> & {
    // "destructive" for irreversible confirmations (red 3D button).
    variant?: "default" | "destructive"
  }
>(({ className, variant = "default", ...props }, ref) => (
  <DialogPrimitive.Close
    ref={ref}
    className={cn(buttonVariants({ variant }), "h-11 w-full px-5 sm:w-auto", className)}
    {...props}
  />
))
AlertDialogAction.displayName = DialogPrimitive.Close.displayName

const AlertDialogCancel = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Close>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Close>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Close
    ref={ref}
    className={cn(
      buttonVariants({ variant: "secondary" }),
      "h-11 w-full px-5 sm:mt-0 sm:w-auto",
      className
    )}
    {...props}
  />
))
AlertDialogCancel.displayName = DialogPrimitive.Close.displayName

export {
  AlertDialog,
  AlertDialogPortal,
  AlertDialogOverlay,
  AlertDialogTrigger,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogFooter,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogAction,
  AlertDialogCancel,
}
