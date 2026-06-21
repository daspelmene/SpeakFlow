import type { ReactNode } from "react";

type CardProps = {
  children: ReactNode;
  className?: string;
};

export default function Card({ children, className = "" }: CardProps) {
  return (
    <div
      className={`rounded-3xl border border-slate-200 bg-white p-6 shadow-sm transition-shadow duration-200 hover:shadow-md ${className}`}
    >
      {children}
    </div>
  );
}