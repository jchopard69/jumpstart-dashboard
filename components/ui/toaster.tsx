"use client";

import * as React from "react";
import { ToastProvider, ToastViewport, Toast, ToastTitle, ToastDescription } from "./toast";
import { cn } from "@/lib/utils";

export type ToastVariant = "default" | "success" | "error" | "warning" | "info";

export type ToastMessage = {
  title: string;
  description?: string;
  variant?: ToastVariant;
  duration?: number;
};

type ToastWithId = ToastMessage & { id: string };

const variantStyles: Record<ToastVariant, string> = {
  default: "border-border bg-card",
  success: "border-emerald-200 bg-emerald-50",
  error: "border-rose-200 bg-rose-50",
  warning: "border-amber-200 bg-amber-50",
  info: "border-blue-200 bg-blue-50"
};

const variantIconStyles: Record<ToastVariant, string> = {
  default: "text-foreground",
  success: "text-emerald-600",
  error: "text-rose-600",
  warning: "text-amber-600",
  info: "text-blue-600"
};

const variantIcons: Record<ToastVariant, React.ReactNode> = {
  default: null,
  success: (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
  error: (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
    </svg>
  ),
  warning: (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
    </svg>
  ),
  info: (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z" />
    </svg>
  )
};

const ToastContext = React.createContext<{
  push: (message: ToastMessage) => void;
  success: (title: string, description?: string) => void;
  error: (title: string, description?: string) => void;
  warning: (title: string, description?: string) => void;
  info: (title: string, description?: string) => void;
} | null>(null);

export function useToast() {
  const ctx = React.useContext(ToastContext);
  if (!ctx) {
    throw new Error("Toast context missing");
  }
  return ctx;
}

export function Toaster({ children }: { children: React.ReactNode }) {
  const [queue, setQueue] = React.useState<ToastWithId[]>([]);

  const removeToast = React.useCallback((id: string) => {
    setQueue((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const push = React.useCallback((message: ToastMessage) => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
    const toast: ToastWithId = { ...message, id };
    setQueue((prev) => [...prev, toast]);

    const duration = message.duration ?? 5000;
    setTimeout(() => removeToast(id), duration);
  }, [removeToast]);

  const success = React.useCallback((title: string, description?: string) => {
    push({ title, description, variant: "success" });
  }, [push]);

  const error = React.useCallback((title: string, description?: string) => {
    push({ title, description, variant: "error", duration: 7000 });
  }, [push]);

  const warning = React.useCallback((title: string, description?: string) => {
    push({ title, description, variant: "warning" });
  }, [push]);

  const info = React.useCallback((title: string, description?: string) => {
    push({ title, description, variant: "info" });
  }, [push]);

  return (
    <ToastProvider>
      <ToastContext.Provider value={{ push, success, error, warning, info }}>
        {children}
        {queue.map((message) => {
          const variant = message.variant ?? "default";
          return (
            <Toast
              key={message.id}
              className={cn(
                "animate-in slide-in-from-top-2 fade-in duration-300",
                variantStyles[variant]
              )}
              onOpenChange={(open) => {
                if (!open) removeToast(message.id);
              }}
            >
              <div className="flex items-start gap-3">
                {variantIcons[variant] && (
                  <div className={cn("mt-0.5 shrink-0", variantIconStyles[variant])}>
                    {variantIcons[variant]}
                  </div>
                )}
                <div className="flex-1">
                  <ToastTitle className={cn(variant !== "default" && variantIconStyles[variant])}>
                    {message.title}
                  </ToastTitle>
                  {message.description ? (
                    <ToastDescription className="mt-1">{message.description}</ToastDescription>
                  ) : null}
                </div>
              </div>
            </Toast>
          );
        })}
        <ToastViewport />
      </ToastContext.Provider>
    </ToastProvider>
  );
}
