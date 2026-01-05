"use client";

import * as React from "react";
import { ToastProvider, ToastViewport, Toast, ToastTitle, ToastDescription } from "./toast";

export type ToastMessage = {
  title: string;
  description?: string;
};

const ToastContext = React.createContext<{
  push: (message: ToastMessage) => void;
} | null>(null);

export function useToast() {
  const ctx = React.useContext(ToastContext);
  if (!ctx) {
    throw new Error("Toast context missing");
  }
  return ctx;
}

export function Toaster({ children }: { children: React.ReactNode }) {
  const [queue, setQueue] = React.useState<ToastMessage[]>([]);

  const push = React.useCallback((message: ToastMessage) => {
    setQueue((prev) => [...prev, message]);
  }, []);

  return (
    <ToastProvider>
      <ToastContext.Provider value={{ push }}>
        {children}
        {queue.map((message, index) => (
          <Toast key={`${message.title}-${index}`}>
            <div>
              <ToastTitle>{message.title}</ToastTitle>
              {message.description ? <ToastDescription>{message.description}</ToastDescription> : null}
            </div>
          </Toast>
        ))}
        <ToastViewport />
      </ToastContext.Provider>
    </ToastProvider>
  );
}
