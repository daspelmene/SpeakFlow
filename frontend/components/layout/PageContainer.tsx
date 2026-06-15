import type { ReactNode } from "react";

type PageContainerProps = {
  children: ReactNode;
};

export default function PageContainer({ children }: PageContainerProps) {
  return <main className="mx-auto w-full max-w-6xl px-4 py-8">{children}</main>;
}