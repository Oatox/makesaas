// Shared look of every modal (Dialog, AlertDialog). Change the modal style here only.

// Dimmed, slightly blurred backdrop.
export const dialogOverlayClass =
  "fixed inset-0 z-50 bg-black/70 backdrop-blur-sm data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0"

// Panel: raised card surface, big radius like the app cards. Bottom sheet on phones,
// centered modal from sm up.
export const dialogContentClass =
  "fixed bottom-0 left-0 right-0 z-50 grid max-h-[calc(100dvh-1rem)] w-full translate-y-0 gap-5 overflow-y-auto " +
  "rounded-t-[24px] border border-border/70 bg-card p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] text-card-foreground " +
  "shadow-2xl shadow-black/60 duration-200 " +
  "data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 " +
  "data-[state=closed]:slide-out-to-bottom data-[state=open]:slide-in-from-bottom " +
  "sm:bottom-auto sm:left-[50%] sm:right-auto sm:top-[50%] sm:max-h-[calc(100vh-2rem)] sm:max-w-lg sm:translate-x-[-50%] sm:translate-y-[-50%] " +
  "sm:rounded-[20px] sm:p-6 sm:data-[state=closed]:slide-out-to-left-1/2 sm:data-[state=closed]:slide-out-to-top-[48%] " +
  "sm:data-[state=closed]:zoom-out-95 sm:data-[state=open]:slide-in-from-left-1/2 sm:data-[state=open]:slide-in-from-top-[48%] sm:data-[state=open]:zoom-in-95"

// Forces the bottom-sheet placement on phones even if a caller passes positioning classes.
export const dialogMobileSheetClass =
  "max-sm:!bottom-0 max-sm:!left-0 max-sm:!right-0 max-sm:!top-auto max-sm:!w-full max-sm:!max-w-none max-sm:!translate-x-0 max-sm:!translate-y-0"

export const dialogHeaderClass = "flex flex-col gap-1.5 pr-8 text-left"

export const dialogFooterClass =
  "flex flex-col-reverse gap-2 pt-1 [&>*]:w-full sm:flex-row sm:justify-end sm:[&>*]:w-auto"

// Unbounded is only loaded from 300 to 500: a bolder title would be faked by the browser.
export const dialogTitleClass = "font-display text-xl font-normal leading-tight tracking-tight"

export const dialogDescriptionClass = "text-sm leading-relaxed text-muted-foreground"
