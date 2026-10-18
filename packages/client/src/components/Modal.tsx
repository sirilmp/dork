import { ReactNode } from 'react';

export function Modal({
  open,
  onClose,
  children,
  widthClassName = 'max-w-2xl',
}: {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  widthClassName?: string;
}) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-900/40 p-4 pt-16"
      onClick={onClose}
    >
      <div
        className={`w-full ${widthClassName} rounded-xl bg-white shadow-xl`}
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  );
}
