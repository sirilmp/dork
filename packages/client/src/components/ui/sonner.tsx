import * as React from 'react';
import { Toaster as Sonner } from 'sonner';

type ToasterProps = React.ComponentProps<typeof Sonner>;

/**
 * shadcn/ui's current (sonner-based) Toaster recipe. Styled via sonner's own
 * `toastOptions.classNames`, reusing the same semantic Tailwind tokens
 * (bg-background, border, text-destructive, ...) as every other shadcn
 * component, so toasts re-theme with branding changes too.
 */
function Toaster({ ...props }: ToasterProps) {
  return (
    <Sonner
      className="toaster group"
      toastOptions={{
        classNames: {
          toast:
            'group toast group-[.toaster]:bg-background group-[.toaster]:text-foreground group-[.toaster]:border-border group-[.toaster]:shadow-lg',
          description: 'group-[.toast]:text-muted-foreground',
          actionButton: 'group-[.toast]:bg-primary group-[.toast]:text-primary-foreground',
          cancelButton: 'group-[.toast]:bg-muted group-[.toast]:text-muted-foreground',
          error: 'group-[.toaster]:border-destructive/50 group-[.toaster]:text-destructive',
          success: 'group-[.toaster]:border-emerald-500/50',
        },
      }}
      {...props}
    />
  );
}

export { Toaster };
