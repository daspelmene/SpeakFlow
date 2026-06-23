"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import PageContainer from "@/components/layout/PageContainer";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import Input from "@/components/ui/Input";
import { getCurrentUser, loginUser } from "@/lib/api";
import { saveTokens } from "@/lib/auth";
import { isProfileComplete } from "@/lib/profile";

type LoginFieldErrors = {
  email?: string;
  password?: string;
};

function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export default function LoginPage() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<LoginFieldErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  function clearFieldError(field: keyof LoginFieldErrors) {
    setFieldErrors((currentErrors) => ({
      ...currentErrors,
      [field]: undefined,
    }));
  }

  function validateForm() {
    const errors: LoginFieldErrors = {};

    if (!email.trim()) {
      errors.email = "Email is required.";
    } else if (!isValidEmail(email)) {
      errors.email = "Enter a valid email address, for example you@example.com.";
    }

    if (!password) {
      errors.password = "Password is required.";
    }

    return errors;
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");

    const validationErrors = validateForm();

    if (Object.keys(validationErrors).length > 0) {
      setFieldErrors(validationErrors);
      return;
    }

    setFieldErrors({});

    try {
      setIsSubmitting(true);

      const tokens = await loginUser({
        email: email.trim(),
        password,
      });

      saveTokens(tokens);

      const user = await getCurrentUser();

      if (isProfileComplete(user)) {
        router.push("/dashboard");
      } else {
        router.push("/profile/setup");
      }
    } catch (submitError) {
      const message =
        submitError instanceof Error ? submitError.message : "Login failed.";

      setError(message);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <PageContainer>
      <div className="mx-auto max-w-md">
        <div className="mb-8 text-center">
          <Badge>Welcome back</Badge>

          <h1 className="mt-4 text-3xl font-bold text-slate-900">
            Log in to SpeakFlow
          </h1>

          <p className="mt-3 text-slate-600">
            Continue practicing languages through focused speaking sessions.
          </p>
        </div>

        <Card>
          <form onSubmit={handleSubmit} noValidate className="space-y-5">
            <Input
              label="Email"
              name="email"
              type="email"
              value={email}
              onChange={(event) => {
                setEmail(event.target.value);
                clearFieldError("email");
              }}
              placeholder="you@example.com"
              autoComplete="email"
              error={fieldErrors.email}
            />

            <Input
              label="Password"
              name="current-password"
              type="password"
              value={password}
              onChange={(event) => {
                setPassword(event.target.value);
                clearFieldError("password");
              }}
              placeholder="Enter your password"
              autoComplete="current-password"
              error={fieldErrors.password}
            />

            {error && (
              <div className="rounded-2xl border border-red-100 bg-red-50 px-5 py-4 text-base font-semibold text-red-700">
                {error}
              </div>
            )}

            <Button type="submit" className="w-full" disabled={isSubmitting}>
              {isSubmitting ? "Logging in..." : "Log in"}
            </Button>

            <p className="text-center text-sm text-slate-600">
              Do not have an account?{" "}
              <Link
                href="/register"
                className="font-medium text-indigo-600 hover:text-indigo-700"
              >
                Create account
              </Link>
            </p>
          </form>
        </Card>
      </div>
    </PageContainer>
  );
}