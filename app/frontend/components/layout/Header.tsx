"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useSyncExternalStore } from "react";

import Button from "@/components/ui/Button";
import { getCurrentUser, isUnauthorizedError } from "@/lib/api";
import { clearTokens, getAccessToken } from "@/lib/auth";
import { removeActiveRoomId } from "@/lib/activeRoomStorage";
import { openOnboardingTutorial } from "@/lib/tutorial";

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

function isProtectedPath(pathname: string) {
  return (
    pathname.startsWith("/dashboard") ||
    pathname.startsWith("/profile") ||
    pathname.startsWith("/session") ||
    pathname.startsWith("/history")
  );
}

export default function Header() {
  const router = useRouter();
  const pathname = usePathname();

  const hasStoredToken = useSyncExternalStore(
    subscribe,
    getAuthSnapshot,
    getServerSnapshot,
  );

  useEffect(() => {
    if (!hasStoredToken) {
      return;
    }

    let isCancelled = false;

    async function validateSession() {
      try {
        await getCurrentUser();
      } catch (error) {
        if (isCancelled) {
          return;
        }

        if (isUnauthorizedError(error)) {
          clearTokens();
          removeActiveRoomId();

          if (isProtectedPath(pathname)) {
            router.replace("/login");
          }
        }
      }
    }

    void validateSession();

    return () => {
      isCancelled = true;
    };
  }, [hasStoredToken, pathname, router]);

  function handleLogOut() {
    clearTokens();
    removeActiveRoomId();
    router.push("/login");
  }

  const shouldShowPrivateNavigation =
    hasStoredToken &&
    pathname !== "/" &&
    pathname !== "/login" &&
    pathname !== "/register";

  const logoHref = shouldShowPrivateNavigation ? "/dashboard" : "/";

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
          {shouldShowPrivateNavigation ? (
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

              <button
                type="button"
                onClick={openOnboardingTutorial}
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-3 py-2 text-base font-bold text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-950 focus:outline-none focus:ring-4 focus:ring-indigo-100"
                aria-label="Open application tutorial"
              >
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  className="h-5 w-5"
                  aria-hidden="true"
                >
                  <circle cx="12" cy="12" r="10" />
                  <path d="M9.5 9a2.5 2.5 0 1 1 4.2 1.8c-.9.7-1.7 1.2-1.7 2.7" />
                  <path d="M12 17h.01" />
                </svg>
                <span className="hidden xl:inline">Help</span>
              </button>

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