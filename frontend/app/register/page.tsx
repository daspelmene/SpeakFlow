"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import Input from "@/components/ui/Input";
import Select from "@/components/ui/Select";
import PageContainer from "@/components/layout/PageContainer";
import { registerUser } from "@/lib/api";
import { saveTokens } from "@/lib/auth";

const languageOptions = [
  "English",
  "Russian",
  "Spanish",
  "French",
  "German",
  "Chinese",
  "Japanese",
  "Korean",
  "Italian",
  "Portuguese",
];

export default function RegisterPage() {
  const router = useRouter();

  const [fullname, setFullname] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [nativeLanguage, setNativeLanguage] = useState("");
  const [targetLanguage, setTargetLanguage] = useState("");

  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  function validateForm() {
    if (!fullname.trim()) {
      return "Full name is required.";
    }

    if (!email.trim()) {
      return "Email is required.";
    }

    if (password.length < 6) {
      return "Password must be at least 6 characters.";
    }

    if (password !== confirmPassword) {
      return "Passwords do not match.";
    }

    if (!nativeLanguage) {
      return "Native language is required.";
    }

    if (!targetLanguage) {
      return "Target language is required.";
    }

    if (nativeLanguage === targetLanguage) {
      return "Native language and target language should be different.";
    }

    return "";
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");

    const validationError = validateForm();

    if (validationError) {
      setError(validationError);
      return;
    }

    try {
      setIsSubmitting(true);

      const tokens = await registerUser({
        email,
        password,
        fullname,
        native_language: nativeLanguage,
        target_language: targetLanguage,

        // These fields belong to profile setup,
        // but backend schema accepts them during registration.
        interests: [],
        bio: null,
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
            Start with your basic account details. You will finish your profile
            in the next step.
          </p>
        </div>

        <Card>
          <form onSubmit={handleSubmit} className="space-y-5">
            <Input
              label="Full name"
              value={fullname}
              onChange={(event) => setFullname(event.target.value)}
              placeholder="Daniil Agafonov"
            />

            <Input
              label="Email"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="you@example.com"
            />

            <div className="grid gap-4 sm:grid-cols-2">
              <Input
                label="Password"
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="At least 6 characters"
              />

              <Input
                label="Confirm password"
                type="password"
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                placeholder="Repeat password"
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <Select
                label="Native language"
                options={languageOptions}
                value={nativeLanguage}
                onChange={(event) => setNativeLanguage(event.target.value)}
              />

              <Select
                label="Target language"
                options={languageOptions}
                value={targetLanguage}
                onChange={(event) => setTargetLanguage(event.target.value)}
              />
            </div>

            {error && (
              <div className="rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">
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