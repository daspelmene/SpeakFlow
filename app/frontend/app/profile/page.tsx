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
import { getCurrentUser, updateCurrentUser, type UserMe } from "@/lib/api";
import { clearTokens, getAccessToken } from "@/lib/auth";
import { isProfileComplete } from "@/lib/profile";

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

function getInitials(name: string) {
  const initials = name
    .trim()
    .split(" ")
    .filter(Boolean)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return initials || "U";
}

export default function ProfilePage() {
  const router = useRouter();

  const [user, setUser] = useState<UserMe | null>(null);
  const [isEditing, setIsEditing] = useState(false);

  const [fullname, setFullname] = useState("");
  const [nativeLanguage, setNativeLanguage] = useState("");
  const [targetLanguage, setTargetLanguage] = useState("");
  const [bio, setBio] = useState("");
  const [interestInput, setInterestInput] = useState("");
  const [interests, setInterests] = useState<string[]>([]);

  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  function fillFormFromUser(profile: UserMe) {
    setFullname(profile.fullname);
    setNativeLanguage(profile.native_language || "");
    setTargetLanguage(profile.target_language || "");
    setBio(profile.bio || "");
    setInterests(profile.interests || []);
    setInterestInput("");
  }

  useEffect(() => {
    async function loadProfile() {
      const token = getAccessToken();

      if (!token) {
        router.replace("/login");
        return;
      }

      try {
        const currentUser = await getCurrentUser();
        setUser(currentUser);
        fillFormFromUser(currentUser);
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
    if (!fullname.trim()) {
      return "Full name is required.";
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

    if (interests.length === 0) {
      return "Add at least one interest.";
    }

    if (bio.trim().length < 10) {
      return "Bio should be at least 10 characters.";
    }

    return "";
  }

  function startEditing() {
    if (user) {
      fillFormFromUser(user);
    }

    setError("");
    setSuccessMessage("");
    setIsEditing(true);
  }

  function cancelEditing() {
    if (user) {
      fillFormFromUser(user);
    }

    setError("");
    setIsEditing(false);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setSuccessMessage("");

    const validationError = validateForm();

    if (validationError) {
      setError(validationError);
      return;
    }

    try {
      setIsSaving(true);

      const updatedUser = await updateCurrentUser({
        fullname: fullname.trim(),
        native_language: nativeLanguage,
        target_language: targetLanguage,
        interests,
        bio: bio.trim(),
      });

      setUser(updatedUser);
      fillFormFromUser(updatedUser);
      setIsEditing(false);
      setSuccessMessage("Profile updated successfully.");
    } catch (submitError) {
      const message =
        submitError instanceof Error
          ? submitError.message
          : "Failed to update profile.";

      setError(message);
    } finally {
      setIsSaving(false);
    }
  }

  if (isLoading) {
    return (
      <PageContainer>
        <Card className="p-8">
          <p className="text-center text-lg font-semibold text-slate-600">
            Loading profile...
          </p>
        </Card>
      </PageContainer>
    );
  }

  if (error && !user) {
    return (
      <PageContainer>
        <Card className="p-8">
          <Badge variant="error">Profile error</Badge>
          <h1 className="mt-5 text-3xl font-black text-slate-950">
            Could not load profile
          </h1>
          <p className="mt-3 text-lg leading-8 text-slate-600">{error}</p>
        </Card>
      </PageContainer>
    );
  }

  if (!user) {
    return null;
  }

  const profileIsComplete = isProfileComplete(user);
  const nativeLanguageLabel = user.native_language || "Not selected";
  const targetLanguageLabel = user.target_language || "Not selected";

  return (
    <PageContainer>
      <div className="mb-10 flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <Badge variant={profileIsComplete ? "info" : "warning"}>
            {profileIsComplete ? "Profile" : "Profile incomplete"}
          </Badge>

          <h1 className="mt-5 text-5xl font-black tracking-tight text-slate-950">
            Your speaking profile
          </h1>

          <p className="mt-5 max-w-3xl text-xl leading-9 text-slate-600">
            View and update your languages, interests, and bio. SpeakFlow uses
            this information to suggest suitable speaking partners.
          </p>
        </div>

        {!isEditing && (
          <Button size="lg" onClick={startEditing}>
            Edit profile
          </Button>
        )}
      </div>

      {successMessage && (
        <div className="mb-6 rounded-2xl border border-emerald-100 bg-emerald-50 px-5 py-4 text-base font-semibold text-emerald-700">
          {successMessage}
        </div>
      )}

      {error && isEditing && (
        <div className="mb-6 rounded-2xl border border-red-100 bg-red-50 px-5 py-4 text-base font-semibold text-red-700">
          {error}
        </div>
      )}

      {isEditing ? (
        <Card className="p-8">
          <form onSubmit={handleSubmit} className="space-y-7">
            <div className="grid gap-5 sm:grid-cols-2">
              <Input
                label="Full name"
                value={fullname}
                onChange={(event) => setFullname(event.target.value)}
                placeholder="Your full name"
              />

              <Input
                label="Email"
                value={user.email}
                disabled
                helperText="Email is used for sign in and cannot be edited here."
              />
            </div>

            <div className="grid gap-5 sm:grid-cols-2">
              <Select
                label="Native language"
                options={languageOptions}
                value={nativeLanguage}
                onChange={(event) => setNativeLanguage(event.target.value)}
                placeholder="Choose your native language"
              />

              <Select
                label="Target language"
                options={languageOptions}
                value={targetLanguage}
                onChange={(event) => setTargetLanguage(event.target.value)}
                placeholder="Choose your target language"
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
              placeholder="Write a short introduction for future speaking partners."
              rows={5}
            />

            <div className="flex flex-col gap-3 sm:flex-row">
              <Button type="submit" disabled={isSaving}>
                {isSaving ? "Saving profile..." : "Save changes"}
              </Button>

              <Button
                type="button"
                variant="secondary"
                onClick={cancelEditing}
                disabled={isSaving}
              >
                Cancel
              </Button>
            </div>
          </form>
        </Card>
      ) : (
        <section className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
          <Card className="p-8">
            <div className="flex items-center gap-5">
              <div className="flex h-20 w-20 items-center justify-center rounded-3xl bg-indigo-600 text-3xl font-black text-white shadow-sm shadow-indigo-200">
                {getInitials(user.fullname)}
              </div>

              <div>
                <h2 className="text-4xl font-black tracking-tight text-slate-950">
                  {user.fullname}
                </h2>

                <p className="mt-2 text-xl font-semibold text-slate-600">
                  {user.email}
                </p>
              </div>
            </div>

            <div className="mt-8 grid gap-4">
              <div className="rounded-3xl border border-slate-200 bg-slate-50 p-5">
                <p className="text-base font-black uppercase tracking-wide text-slate-400">
                  Native language
                </p>
                <p className="mt-2 text-2xl font-black text-slate-950">
                  {nativeLanguageLabel}
                </p>
              </div>

              <div className="rounded-3xl border border-slate-200 bg-slate-50 p-5">
                <p className="text-base font-black uppercase tracking-wide text-slate-400">
                  Target language
                </p>
                <p className="mt-2 text-2xl font-black text-indigo-700">
                  {targetLanguageLabel}
                </p>
              </div>
            </div>
          </Card>

          <Card className="p-8">
            <h2 className="text-4xl font-black tracking-tight text-slate-950">
              Practice information
            </h2>

            <p className="mt-5 text-xl leading-9 text-slate-600">
              These details are loaded from your account data and can be updated
              anytime.
            </p>

            <div className="mt-8">
              <h3 className="text-2xl font-black text-slate-950">Interests</h3>

              {user.interests.length > 0 ? (
                <div className="mt-4 flex flex-wrap gap-3">
                  {user.interests.map((interest) => (
                    <span
                      key={interest}
                      className="rounded-full bg-indigo-50 px-4 py-2 text-base font-bold text-indigo-700 ring-1 ring-indigo-100"
                    >
                      {interest}
                    </span>
                  ))}
                </div>
              ) : (
                <p className="mt-4 text-lg leading-8 text-slate-500">
                  No interests added yet.
                </p>
              )}
            </div>

            <div className="mt-8 rounded-3xl border border-slate-200 bg-slate-50 p-6">
              <h3 className="text-2xl font-black text-slate-950">Bio</h3>

              <p className="mt-4 text-xl leading-9 text-slate-600">
                {user.bio || "No bio added yet."}
              </p>
            </div>

            {profileIsComplete ? (
              <div className="mt-8 rounded-3xl border border-emerald-100 bg-emerald-50 p-6">
                <Badge variant="success">Matching summary</Badge>

                <p className="mt-4 text-xl leading-9 text-emerald-900">
                  You can help others with {nativeLanguageLabel} and practice{" "}
                  {targetLanguageLabel} with suitable partners.
                </p>
              </div>
            ) : (
              <div className="mt-8 rounded-3xl border border-amber-100 bg-amber-50 p-6">
                <Badge variant="warning">Action needed</Badge>

                <p className="mt-4 text-xl leading-9 text-amber-900">
                  Complete your languages, interests, and bio before using the
                  dashboard.
                </p>
              </div>
            )}
          </Card>
        </section>
      )}
    </PageContainer>
  );
}
