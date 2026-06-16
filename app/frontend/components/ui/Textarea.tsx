import type { TextareaHTMLAttributes } from "react";

type TextareaProps = TextareaHTMLAttributes<HTMLTextAreaElement> & {
  label?: string;
};

export default function Textarea({ label, className = "", ...props }: TextareaProps) {
  return (
    <label className="block">
      {label && <span className="mb-1 block text-sm font-medium text-slate-700">{label}</span>}
      <textarea
        className={`w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 ${className}`}
        {...props}
      />
    </label>
  );
}