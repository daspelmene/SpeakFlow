import type { ReactNode } from "react";

type BadgeProps = {
  children: ReactNode;
  variant?: "success" | "info" | "warning";
};

export default function Badge({ children, variant = "info" }: BadgeProps) {
  const variants = {
    success: "bg-emerald-50 text-emerald-700 ring-emerald-100",
    info: "bg-indigo-50 text-indigo-700 ring-indigo-100",
    warning: "bg-amber-50 text-amber-700 ring-amber-100",
  };

  return (
    <span className={`inline-flex rounded-full px-3 py-1 text-xs font-medium ring-1 ${variants[variant]}`}>
      {children}
    </span>
  );
}