"use client";

import { FormEvent, KeyboardEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import Input from "@/components/ui/Input";
import Textarea from "@/components/ui/Textarea";
import PageContainer from "@/components/layout/PageContainer";
import { getCurrentUser, updateCurrentUser } from "@/lib/api";
import { getAccessToken } from "@/lib/auth";

const suggestedInterests = [
  "IT",
  "Education",
  "Travel",
  "Movies",
  "Music",
  "Culture",
  "Business",
  "Sports",
];

const MOCK_PROFILE_KEY = "speakflow_mock_profile_setup";

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
  const [isMockMode, setIsMockMode] = useState(false);

  useEffect(() => {
    async function loadProfile() {
      const token = getAccessToken();

      if (!token) {
        setIsMockMode(true);

        const savedMockProfile = localStorage.getItem(MOCK_PROFILE_KEY);

        if (savedMockProfile) {
          const parsedProfile = JSON.parse(savedMockProfile);

          setFullname(parsedProfile.fullname || "Demo User");
          setNativeLanguage(parsedProfile.native_language || "Russian");
          setTargetLanguage(parsedProfile.target_language || "English");
          setBio(parsedProfile.bio || "");
          setInterests(parsedProfile.interests || []);
        } else {
          setFullname("Demo User");
          setNativeLanguage("Russian");
          setTargetLanguage("English");
          setBio("");
          setInterests([]);
        }

        setIsLoading(false);
        return;
      }

      try {
        const user = await getCurrentUser();

        setFullname(user.fullname);
        setNativeLanguage(user.native_language);
        setTargetLanguage(user.target_language);
        setBio(user.bio || "");
        setInterests(user.interests || []);
      } catch (loadError) {
        const message =
          loadError instanceof Error
            ? loadError.message
            : "Failed to load profile.";

        setError(message);
      } finally {
        setIsLoading(false);
      }
    }

    loadProfile();
  }, []);

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

      const token = getAccessToken();

      if (!token) {
        localStorage.setItem(
          MOCK_PROFILE_KEY,
          JSON.stringify({
            fullname,
            native_language: nativeLanguage,
            target_language: targetLanguage,
            interests,
            bio: bio.trim(),
          }),
        );

        router.push("/dashboard");
        return;
      }

      await updateCurrentUser({
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
        <div className="mx-auto max-w-2xl">
          <Card>
            <p className="text-center text-slate-600">Loading profile...</p>
          </Card>
        </div>
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      <div className="mx-auto max-w-2xl">
        <div className="mb-8 text-center">
          <Badge>Profile setup</Badge>

          <h1 className="mt-4 text-3xl font-bold text-slate-900">
            Finish your profile
          </h1>

          <p className="mt-3 text-slate-600">
            Add your interests and a short bio so other learners can understand
            what you want to practice.
          </p>

          {isMockMode && (
            <p className="mt-3 rounded-xl bg-amber-50 px-4 py-2 text-sm text-amber-700">
              Demo mode: backend is not connected yet, so profile data will be
              saved locally.
            </p>
          )}
        </div>

        <Card>
          <div className="mb-6 rounded-2xl bg-slate-50 p-4">
            <p className="text-sm font-medium text-slate-500">
              Account details
            </p>

            <div className="mt-3 grid gap-3 sm:grid-cols-3">
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
                  Name
                </p>
                <p className="mt-1 font-medium text-slate-800">{fullname}</p>
              </div>

              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
                  Native
                </p>
                <p className="mt-1 font-medium text-slate-800">
                  {nativeLanguage}
                </p>
              </div>

              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
                  Target
                </p>
                <p className="mt-1 font-medium text-slate-800">
                  {targetLanguage}
                </p>
              </div>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">
                Interests
              </label>

              <div className="flex gap-2">
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

              <div className="mt-3 flex flex-wrap gap-2">
                {suggestedInterests.map((interest) => (
                  <button
                    key={interest}
                    type="button"
                    onClick={() => addInterest(interest)}
                    className="rounded-full border border-slate-200 px-3 py-1 text-xs font-medium text-slate-600 transition-colors hover:border-indigo-200 hover:bg-indigo-50 hover:text-indigo-700"
                  >
                    + {interest}
                  </button>
                ))}
              </div>

              {interests.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-2">
                  {interests.map((interest) => (
                    <button
                      key={interest}
                      type="button"
                      onClick={() => removeInterest(interest)}
                      className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700 ring-1 ring-emerald-100 transition-colors hover:bg-emerald-100"
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
            />

            {error && (
              <div className="rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">
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