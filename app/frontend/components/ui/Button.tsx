import type { ButtonHTMLAttributes, ReactNode } from "react";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  children: ReactNode;
  variant?: "primary" | "secondary" | "ghost" | "danger";
  size?: "sm" | "md" | "lg";
  fullWidth?: boolean;
};

export default function Button({
  children,
  variant = "primary",
  size = "md",
  fullWidth = false,
  className = "",
  disabled,
  ...props
}: ButtonProps) {
  const baseStyles =
    "inline-flex items-center justify-center rounded-2xl font-black transition-all duration-200 focus:outline-none focus:ring-4 focus:ring-indigo-100 disabled:cursor-not-allowed disabled:opacity-50";

  const variants = {
    primary:
      "bg-indigo-600 text-white shadow-sm shadow-indigo-200 enabled:hover:bg-indigo-700 enabled:hover:shadow-md",
    secondary:
      "border border-slate-200 bg-white text-slate-800 shadow-sm enabled:hover:border-slate-300 enabled:hover:bg-slate-50",
    ghost:
      "bg-transparent text-slate-700 enabled:hover:bg-slate-100 enabled:hover:text-slate-950",
    danger:
      "bg-red-600 text-white shadow-sm shadow-red-200 enabled:hover:bg-red-700",
  };

  const sizes = {
    sm: "min-h-12 px-5 py-3 text-lg",
    md: "min-h-13 px-6 py-3.5 text-lg",
    lg: "min-h-14 px-7 py-4 text-xl",
  };

  return (
    <button
      className={`${baseStyles} ${variants[variant]} ${sizes[size]} ${
        fullWidth ? "w-full" : ""
      } ${className}`}
      disabled={disabled}
      {...props}
    >
      {children}
    </button>
  );
}