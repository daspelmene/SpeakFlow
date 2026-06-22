"use client";

import { FormEvent, KeyboardEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import PageContainer from "@/components/layout/PageContainer";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import Input from "@/components/ui/Input";
import Select from "@/components/ui/Select";
import Textarea from "@/components/ui/Textarea";
import { getCurrentUser, updateCurrentUser } from "@/lib/api";
import { clearTokens, getAccessToken } from "@/lib/auth";

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
  "Arabic",
  "Turkish",
];

const suggestedInterests = [
  "IT",
  "Education",
  "Travel",
  "Movies",
  "Music",
  "Culture",
  "Business",
  "Sports",
  "Startups",
  "Gaming",
  "Reading",
  "Science",
];

export default function ProfileSetupPage() {
  const router = useRouter();

  const [fullname, setFullname] = useState("");
  const [nativeLanguage, setNativeLanguage] = useState("");
  const [targetLanguage, setTargetLanguage] = useState("");
  const [bio, setBio] = useState("");
  const [interestInput, setInterestInput] = useState("");
  const [interests, setInterests] = useState<string[]>([]);

  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    async function loadProfile() {
      const token = getAccessToken();

      if (!token) {
        router.replace("/login");
        return;
      }

      try {
        const user = await getCurrentUser();

        setFullname(user.fullname);
        setNativeLanguage(user.native_language || "");
        setTargetLanguage(user.target_language || "");
        setBio(user.bio || "");
        setInterests(user.interests || []);
      } catch (loadError) {
        clearTokens();

        const message =
          loadError instanceof Error
            ? loadError.message
            : "Failed to load profile.";

        setError(message);
        router.replace("/login");
      } finally {
        setIsLoading(false);
      }
    }

    loadProfile();
  }, [router]);

  function addInterest(value: string) {
    const normalizedInterest = value.trim();

    if (!normalizedInterest) {
      return;
    }

    if (interests.includes(normalizedInterest)) {
      setInterestInput("");
      return;
    }

    setInterests((currentInterests) => [
      ...currentInterests,
      normalizedInterest,
    ]);
    setInterestInput("");
  }

  function removeInterest(interestToRemove: string) {
    setInterests((currentInterests) =>
      currentInterests.filter((interest) => interest !== interestToRemove),
    );
  }

  function handleInterestKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Enter") {
      event.preventDefault();
      addInterest(interestInput);
    }
  }

  function validateForm() {
    if (!nativeLanguage) {
      return "Native language is required.";
    }

    if (!targetLanguage) {
      return "Target language is required.";
    }

    if (nativeLanguage === targetLanguage) {
      return "Native language and target language should be different.";
    }

    if (interests.length === 0) {
      return "Add at least one interest.";
    }

    if (bio.trim().length < 10) {
      return "Bio should be at least 10 characters.";
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

      await updateCurrentUser({
        native_language: nativeLanguage,
        target_language: targetLanguage,
        interests,
        bio: bio.trim(),
      });

      router.push("/dashboard");
    } catch (submitError) {
      const message =
        submitError instanceof Error
          ? submitError.message
          : "Failed to save profile.";

      setError(message);
    } finally {
      setIsSubmitting(false);
    }
  }

  if (isLoading) {
    return (
      <PageContainer>
        <div className="mx-auto max-w-3xl">
          <Card className="p-8">
            <p className="text-center text-lg font-semibold text-slate-600">
              Loading profile...
            </p>
          </Card>
        </div>
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      <div className="mx-auto max-w-3xl">
        <div className="mb-10 text-center">
          <Badge>Profile setup</Badge>

          <h1 className="mt-5 text-5xl font-black tracking-tight text-slate-950">
            Finish your profile
          </h1>

          <p className="mx-auto mt-5 max-w-2xl text-xl leading-9 text-slate-600">
            Add your languages, interests, and a short bio so SpeakFlow can
            suggest better speaking partners.
          </p>
        </div>

        <Card className="p-8">
          <div className="mb-8 rounded-3xl bg-slate-50 p-6">
            <p className="text-base font-black uppercase tracking-wide text-slate-400">
              Account
            </p>

            <p className="mt-2 text-2xl font-black text-slate-950">
              {fullname || "Your account"}
            </p>

            <p className="mt-2 text-lg leading-8 text-slate-600">
              Complete this required profile before opening your dashboard.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-7">
            <div className="grid gap-5 sm:grid-cols-2">
              <Select
                label="Native language"
                options={languageOptions}
                value={nativeLanguage}
                onChange={(event) => setNativeLanguage(event.target.value)}
                placeholder="Choose your native language"
                helperText="The language you can help other learners with."
              />

              <Select
                label="Target language"
                options={languageOptions}
                value={targetLanguage}
                onChange={(event) => setTargetLanguage(event.target.value)}
                placeholder="Choose your target language"
                helperText="The language you want to practice."
              />
            </div>

            <div>
              <label className="mb-3 block text-base font-bold text-slate-800">
                Interests
              </label>

              <div className="flex flex-col gap-3 sm:flex-row">
                <Input
                  value={interestInput}
                  onChange={(event) => setInterestInput(event.target.value)}
                  onKeyDown={handleInterestKeyDown}
                  placeholder="Type interest and press Enter"
                />

                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => addInterest(interestInput)}
                >
                  Add
                </Button>
              </div>

              <div className="mt-4 flex flex-wrap gap-3">
                {suggestedInterests.map((interest) => (
                  <button
                    key={interest}
                    type="button"
                    onClick={() => addInterest(interest)}
                    className="rounded-full border border-slate-200 bg-white px-4 py-2 text-base font-bold text-slate-600 transition-colors hover:border-indigo-200 hover:bg-indigo-50 hover:text-indigo-700"
                  >
                    + {interest}
                  </button>
                ))}
              </div>

              {interests.length > 0 && (
                <div className="mt-5 flex flex-wrap gap-3">
                  {interests.map((interest) => (
                    <button
                      key={interest}
                      type="button"
                      onClick={() => removeInterest(interest)}
                      className="rounded-full bg-emerald-50 px-4 py-2 text-base font-bold text-emerald-700 ring-1 ring-emerald-100 transition-colors hover:bg-emerald-100"
                    >
                      {interest} ×
                    </button>
                  ))}
                </div>
              )}
            </div>

            <Textarea
              label="Bio"
              value={bio}
              onChange={(event) => setBio(event.target.value)}
              placeholder="Example: I want to practice English speaking and discuss technology, travel, and movies."
              rows={5}
              helperText="Write a short introduction that future speaking partners can read."
            />

            {error && (
              <div className="rounded-2xl border border-red-100 bg-red-50 px-5 py-4 text-base font-semibold text-red-700">
                {error}
              </div>
            )}

            <Button type="submit" className="w-full" disabled={isSubmitting}>
              {isSubmitting ? "Saving profile..." : "Continue to dashboard"}
            </Button>
          </form>
        </Card>
      </div>
    </PageContainer>
  );
}
