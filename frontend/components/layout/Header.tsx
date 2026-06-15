import Link from "next/link";
import Button from "@/components/ui/Button";

export default function Header() {
  return (
    <header className="border-b border-slate-200 bg-white">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4">
        <Link href="/" className="text-xl font-bold text-slate-900">
          SpeakFlow
        </Link>

        <nav className="flex items-center gap-3">
          <Link href="/login" className="text-sm text-slate-600 hover:text-slate-900">
            Login
          </Link>
          <Link href="/register">
            <Button>Get started</Button>
          </Link>
        </nav>
      </div>
    </header>
  );
}