import { useToast } from "@/hooks/use-toast"
import { CheckCircle2, AlertCircle } from "lucide-react"
import {
  Toast,
  ToastClose,
  ToastDescription,
  ToastProvider,
  ToastTitle,
  ToastViewport,
} from "@/components/ui/toast"

export function Toaster() {
  const { toasts } = useToast()

  return (
    <ToastProvider>
      {toasts.map(function ({ id, title, description, action, ...props }) {
        const isError = props.variant === "destructive"
        const Icon = isError ? AlertCircle : CheckCircle2
        return (
          <Toast key={id} {...props}>
            <div
              className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] ${
                isError ? "bg-destructive/15 text-destructive" : "bg-success/15 text-success"
              }`}
            >
              <Icon className="h-[18px] w-[18px]" />
            </div>
            <div className="grid min-w-0 flex-1 gap-0.5">
              {title && <ToastTitle>{title}</ToastTitle>}
              {description && (
                <ToastDescription>{description}</ToastDescription>
              )}
            </div>
            {action}
            <ToastClose />
          </Toast>
        )
      })}
      <ToastViewport />
    </ToastProvider>
  )
}
