"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import PageContainer from "@/components/layout/PageContainer";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import Input from "@/components/ui/Input";
import { registerUser } from "@/lib/api";
import { saveTokens } from "@/lib/auth";

type RegisterFieldErrors = {
  fullname?: string;
  email?: string;
  password?: string;
  confirmPassword?: string;
};

function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function isStrongPassword(password: string) {
  return password.length >= 8 && /[A-Za-z]/.test(password) && /\d/.test(password);
}

export default function RegisterPage() {
  const router = useRouter();

  const [fullname, setFullname] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<RegisterFieldErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  function clearFieldError(field: keyof RegisterFieldErrors) {
    setFieldErrors((currentErrors) => ({
      ...currentErrors,
      [field]: undefined,
    }));
  }

  function validateForm() {
    const errors: RegisterFieldErrors = {};

    if (!fullname.trim()) {
      errors.fullname = "Full name is required.";
    }

    if (!email.trim()) {
      errors.email = "Email is required.";
    } else if (!isValidEmail(email)) {
      errors.email = "Enter a valid email address, for example you@example.com.";
    }

    if (!password) {
      errors.password = "Password is required.";
    } else if (!isStrongPassword(password)) {
      errors.password =
        "Password must be at least 8 characters and include letters and numbers.";
    }

    if (!confirmPassword) {
      errors.confirmPassword = "Please confirm your password.";
    } else if (password !== confirmPassword) {
      errors.confirmPassword = "Passwords do not match.";
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

      const tokens = await registerUser({
        email: email.trim(),
        password,
        fullname: fullname.trim(),
      });

      saveTokens(tokens);
      router.push("/profile/setup");
    } catch (submitError) {
      const message =
        submitError instanceof Error
          ? submitError.message
          : "Registration failed.";

      setError(message);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <PageContainer>
      <div className="mx-auto max-w-xl">
        <div className="mb-8 text-center">
          <Badge>Join SpeakFlow</Badge>

          <h1 className="mt-4 text-3xl font-bold text-slate-900">
            Create your account
          </h1>

          <p className="mt-3 text-slate-600">
            Create an account first. You will complete your language profile in
            the next step.
          </p>
        </div>

        <Card>
          <form onSubmit={handleSubmit} noValidate className="space-y-5">
            <Input
              label="Full name"
              name="fullname"
              value={fullname}
              onChange={(event) => {
                setFullname(event.target.value);
                clearFieldError("fullname");
              }}
              placeholder="Daniil Agafonov"
              autoComplete="name"
              error={fieldErrors.fullname}
            />

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

            <div className="grid gap-4 sm:grid-cols-2">
              <Input
                label="Password"
                name="new-password"
                type="password"
                value={password}
                onChange={(event) => {
                  setPassword(event.target.value);
                  clearFieldError("password");
                }}
                placeholder="At least 8 characters"
                autoComplete="new-password"
                error={fieldErrors.password}
              />

              <Input
                label="Confirm password"
                name="confirm-password"
                type="password"
                value={confirmPassword}
                onChange={(event) => {
                  setConfirmPassword(event.target.value);
                  clearFieldError("confirmPassword");
                }}
                placeholder="Repeat password"
                autoComplete="new-password"
                error={fieldErrors.confirmPassword}
              />
            </div>

            {error && (
              <div className="rounded-2xl border border-red-100 bg-red-50 px-5 py-4 text-base font-semibold text-red-700">
                {error}
              </div>
            )}

            <Button type="submit" className="w-full" disabled={isSubmitting}>
              {isSubmitting ? "Creating account..." : "Create account"}
            </Button>

            <p className="text-center text-sm text-slate-600">
              Already have an account?{" "}
              <Link
                href="/login"
                className="font-medium text-indigo-600 hover:text-indigo-700"
              >
                Log in
              </Link>
            </p>
          </form>
        </Card>
      </div>
    </PageContainer>
  );
}