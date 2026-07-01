"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useSyncExternalStore } from "react";
import { removeActiveRoomId } from "@/lib/activeRoomStorage";
import Button from "@/components/ui/Button";
import { clearTokens, getAccessToken } from "@/lib/auth";

function subscribe(callback: () => void) {
  window.addEventListener("storage", callback);
  window.addEventListener("speakflow-auth-change", callback);

  return () => {
    window.removeEventListener("storage", callback);
    window.removeEventListener("speakflow-auth-change", callback);
  };
}

function getAuthSnapshot() {
  return Boolean(getAccessToken());
}

function getServerSnapshot() {
  return false;
}

export default function Header() {
  const router = useRouter();
  const pathname = usePathname();

  const isLoggedIn = useSyncExternalStore(
    subscribe,
    getAuthSnapshot,
    getServerSnapshot,
  );

  function handleLogOut() {
    clearTokens();
    removeActiveRoomId();
    router.push("/login");
  }

  const logoHref = isLoggedIn ? "/dashboard" : "/";

  return (
    <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/90 backdrop-blur">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
        <Link href={logoHref} className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-indigo-600 text-xl font-black text-white shadow-sm">
            S
          </div>

          <div>
            <p className="text-2xl font-black tracking-tight text-slate-950">
              SpeakFlow
            </p>
            <p className="hidden text-sm font-semibold text-slate-500 sm:block">
              Structured language practice
            </p>
          </div>
        </Link>

        <nav className="flex items-center gap-3">
          {isLoggedIn ? (
            <>
              <Link
                href="/dashboard"
                className={`inline-flex min-h-11 items-center justify-center rounded-xl px-4 py-2 text-base font-bold transition-colors hover:bg-slate-100 hover:text-slate-950 ${
                  pathname === "/dashboard"
                    ? "bg-slate-100 text-slate-950"
                    : "text-slate-600"
                }`}
              >
                Dashboard
              </Link>

              <Link
                href="/profile"
                className={`inline-flex min-h-11 items-center justify-center rounded-xl px-4 py-2 text-base font-bold transition-colors hover:bg-slate-100 hover:text-slate-950 ${
                  pathname.startsWith("/profile")
                    ? "bg-slate-100 text-slate-950"
                    : "text-slate-600"
                }`}
              >
                Profile
              </Link>

              <Button
                type="button"
                variant="secondary"
                size="md"
                onClick={handleLogOut}
              >
                Log out
              </Button>
            </>
          ) : (
            <>
              <Link
                href="/login"
                className={`inline-flex min-h-11 items-center justify-center rounded-xl px-4 py-2 text-base font-bold transition-colors hover:bg-slate-100 hover:text-slate-950 ${
                  pathname === "/login"
                    ? "bg-slate-100 text-slate-950"
                    : "text-slate-600"
                }`}
              >
                Login
              </Link>

              <Link
                href="/register"
                className="inline-flex min-h-11 items-center justify-center rounded-xl bg-indigo-600 px-5 py-2.5 text-base font-bold text-white shadow-sm shadow-indigo-200 transition-colors hover:bg-indigo-700"
              >
                Get started
              </Link>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}