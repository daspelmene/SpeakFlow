import type { ReactNode } from "react";

type BadgeProps = {
  children: ReactNode;
  variant?: "success" | "info" | "warning" | "error" | "neutral";
};

export default function Badge({ children, variant = "info" }: BadgeProps) {
  const variants = {
    success: "bg-emerald-50 text-emerald-700 ring-emerald-100",
    info: "bg-indigo-50 text-indigo-700 ring-indigo-100",
    warning: "bg-amber-50 text-amber-700 ring-amber-100",
    error: "bg-red-50 text-red-700 ring-red-100",
    neutral: "bg-slate-100 text-slate-700 ring-slate-200",
  };

  return (
    <span
      className={`inline-flex items-center rounded-full px-4 py-2 text-base font-black ring-1 ${variants[variant]}`}
    >
      {children}
    </span>
  );
}