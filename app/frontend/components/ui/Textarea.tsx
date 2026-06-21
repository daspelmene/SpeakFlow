import type { TextareaHTMLAttributes } from "react";

type TextareaProps = TextareaHTMLAttributes<HTMLTextAreaElement> & {
  label?: string;
  helperText?: string;
  error?: string;
};

export default function Textarea({
  label,
  helperText,
  error,
  className = "",
  ...props
}: TextareaProps) {
  return (
    <label className="block w-full">
      {label && (
        <span className="mb-2 block text-base font-bold text-slate-800">
          {label}
        </span>
      )}

      <textarea
        className={`min-h-32 w-full resize-y rounded-2xl border bg-white px-4 py-3 text-base font-medium leading-7 text-slate-800 shadow-sm outline-none transition-all placeholder:text-slate-400 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400 ${
          error ? "border-red-300" : "border-slate-200"
        } ${className}`}
        {...props}
      />

      {helperText && !error && (
        <p className="mt-2 text-sm text-slate-500">{helperText}</p>
      )}

      {error && <p className="mt-2 text-sm font-medium text-red-600">{error}</p>}
    </label>
  );
}