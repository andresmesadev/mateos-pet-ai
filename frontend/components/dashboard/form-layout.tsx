"use client";

import type { ComponentProps, ReactNode } from "react";
import { DialogContent, DialogHeader, DialogFooter } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { FieldError } from "./form-feedback";

export function FormDialogContent({ className, ...props }: ComponentProps<typeof DialogContent>) {
  return <DialogContent className={cn("flex max-h-[92dvh] w-[calc(100%-1.5rem)] max-w-2xl flex-col overflow-hidden p-0", className)} {...props} />;
}

export function FormDialogHeader({ className, ...props }: ComponentProps<typeof DialogHeader>) {
  return <DialogHeader className={cn("shrink-0 border-border px-4 pr-14 sm:px-6 sm:pr-14", className)} {...props} />;
}

export function FormDialogBody({ className, ...props }: ComponentProps<"div">) {
  return <div data-form-body className={cn("min-h-0 flex-1 space-y-6 overflow-y-auto px-4 py-5 sm:px-6", className)} {...props} />;
}

export function FormDialogFooter({ className, ...props }: ComponentProps<typeof DialogFooter>) {
  return <DialogFooter className={cn("shrink-0 flex-col-reverse items-stretch border-border px-4 sm:flex-row sm:items-center sm:px-6 [&_button]:min-h-11 [&_button]:whitespace-normal", className)} {...props} />;
}

export function FormSection({ title, description, children, className }: { title: ReactNode; description?: string; children: ReactNode; className?: string }) {
  return <fieldset className={cn("min-w-0 space-y-4 rounded-xl border border-border p-4", className)}>
    <legend className="max-w-full px-2 text-base font-semibold">{title}</legend>
    {description && <p className="text-sm text-muted-foreground">{description}</p>}
    {children}
  </fieldset>;
}

export function FormField({ id, label, optional, hint, error, children, className }: { id: string; label: string; optional?: boolean; hint?: string; error?: string; children: ReactNode; className?: string }) {
  return <div className={cn("min-w-0 space-y-2", className)}>
    <label htmlFor={id} className="block text-sm font-semibold">{label}{optional && <span className="font-normal text-muted-foreground"> (opcional)</span>}</label>
    {children}
    {hint && <p id={`${id}-hint`} className="text-xs text-muted-foreground">{hint}</p>}
    <FieldError id={id} message={error} />
  </div>;
}

export function FormAdditional({ children }: { children: ReactNode }) {
  return <details className="rounded-xl border border-border p-4">
    <summary className="min-h-11 cursor-pointer py-3 text-sm font-semibold focus-visible:outline-2 focus-visible:outline-primary">Información adicional (opcional)</summary>
    <div className="mt-4 space-y-4">{children}</div>
  </details>;
}
