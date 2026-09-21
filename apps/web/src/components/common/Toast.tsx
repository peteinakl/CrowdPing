import * as ToastPrimitive from '@radix-ui/react-toast';
import { createContext, useCallback, useContext, useState, type ReactNode } from 'react';

interface ToastMessage {
  id: number;
  title: string;
  variant: 'success' | 'error';
}

interface ToastContextValue {
  showToast: (title: string, variant?: ToastMessage['variant']) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [messages, setMessages] = useState<ToastMessage[]>([]);

  const showToast = useCallback((title: string, variant: ToastMessage['variant'] = 'success') => {
    setMessages((prev) => [...prev, { id: Date.now() + Math.random(), title, variant }]);
  }, []);

  const dismiss = useCallback((id: number) => {
    setMessages((prev) => prev.filter((m) => m.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ showToast }}>
      <ToastPrimitive.Provider swipeDirection="right" duration={4000}>
        {children}
        {messages.map((message) => (
          <ToastPrimitive.Root
            key={message.id}
            onOpenChange={(open) => {
              if (!open) dismiss(message.id);
            }}
            className={`rounded-[var(--radius-md)] border px-4 py-3 [box-shadow:var(--shadow-card-hover)] data-[state=open]:animate-[toast-in_220ms_var(--ease-spring)] data-[state=closed]:motion-safe:animate-[toast-out_150ms_ease-in] data-[swipe=end]:motion-safe:animate-[toast-out_150ms_ease-in] ${
              message.variant === 'success'
                ? 'border-success-600/30 bg-white text-success-600'
                : 'border-red-300 bg-white text-red-700'
            }`}
          >
            <ToastPrimitive.Title className="text-sm font-semibold">{message.title}</ToastPrimitive.Title>
          </ToastPrimitive.Root>
        ))}
        {/* bottom-24 (not bottom-4) so a toast never lands on top of FormActionBar's fixed
            bottom bar (~80px tall) on pages that have one — a real overlap confirmed visually,
            not just theoretical. Harmless extra clearance on pages without one. */}
        <ToastPrimitive.Viewport className="fixed bottom-24 right-4 z-50 flex w-80 max-w-[calc(100vw-2rem)] flex-col gap-2 outline-none" />
      </ToastPrimitive.Provider>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within a ToastProvider');
  return ctx;
}
