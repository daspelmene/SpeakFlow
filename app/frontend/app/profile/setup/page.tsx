"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import InterestSelector from "@/components/InterestSelector";
import PageContainer from "@/components/layout/PageContainer";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import Select from "@/components/ui/Select";
import Textarea from "@/components/ui/Textarea";
import { getCurrentUser, updateCurrentUser } from "@/lib/api";
import { getAccessToken } from "@/lib/auth";

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

type ProfileSetupErrors = {
  nativeLanguage?: string;
  targetLanguage?: string;
  interests?: string;
  bio?: string;
};

function FieldWarning({ message }: { message?: string }) {
  if (!message) {
    return null;
  }

  return (
    <div className="mt-2 rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
      {message}
    </div>
  );
}

function FormAlert({
  message,
  variant = "error",
}: {
  message?: string;
  variant?: "error" | "warning";
}) {
  if (!message) {
    return null;
  }

  const classes =
    variant === "warning"
      ? "border-amber-100 bg-amber-50 text-amber-700"
      : "border-red-100 bg-red-50 text-red-700";

  return (
    <div
      className={`rounded-2xl border px-4 py-3 text-sm font-semibold ${classes}`}
    >
      {message}
    </div>
  );
}

export default function ProfileSetupPage() {
  const router = useRouter();

  const [fullname, setFullname] = useState("");
  const [nativeLanguage, setNativeLanguage] = useState("");
  const [targetLanguage, setTargetLanguage] = useState("");
  const [bio, setBio] = useState("");
  const [interestInput, setInterestInput] = useState("");
  const [interests, setInterests] = useState<string[]>([]);

  const [formError, setFormError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<ProfileSetupErrors>({});
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
        const message =
          loadError instanceof Error
            ? loadError.message
            : "Failed to load profile.";

        setFormError(message);
      } finally {
        setIsLoading(false);
      }
    }

    loadProfile();
  }, [router]);

  function clearFieldError(field: keyof ProfileSetupErrors) {
    setFieldErrors((currentErrors) => ({
      ...currentErrors,
      [field]: undefined,
    }));
  }

  function addInterest(value: string) {
    const normalizedInterest = value.trim();

    if (!normalizedInterest) {
      return;
    }

    const alreadySelected = interests.some(
      (interest) =>
        interest.trim().toLowerCase() === normalizedInterest.toLowerCase(),
    );

    if (alreadySelected) {
      setInterestInput("");
      return;
    }

    setInterests((currentInterests) => [
      ...currentInterests,
      normalizedInterest,
    ]);
    setInterestInput("");
    clearFieldError("interests");
  }

  function removeInterest(interestToRemove: string) {
    setInterests((currentInterests) =>
      currentInterests.filter((interest) => interest !== interestToRemove),
    );
  }


  function validateForm() {
    const errors: ProfileSetupErrors = {};

    if (!nativeLanguage) {
      errors.nativeLanguage = "Native language is required.";
    }

    if (!targetLanguage) {
      errors.targetLanguage = "Target language is required.";
    } else if (nativeLanguage && nativeLanguage === targetLanguage) {
      errors.targetLanguage =
        "Target language should be different from native language.";
    }

    if (interests.length === 0) {
      errors.interests = "Add at least one interest.";
    }

    if (!bio.trim()) {
      errors.bio = "Bio is required.";
    } else if (bio.trim().length < 10) {
      errors.bio = "Bio should be at least 10 characters.";
    }

    return errors;
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError("");

    const validationErrors = validateForm();

    if (Object.keys(validationErrors).length > 0) {
      setFieldErrors(validationErrors);
      return;
    }

    setFieldErrors({});

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

      setFormError(message);
    } finally {
      setIsSubmitting(false);
    }
  }

  if (isLoading) {
    return (
      <PageContainer>
        <div className="mx-auto max-w-2xl">
          <Card className="p-7">
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
      <div className="mx-auto max-w-2xl">
        <div className="mb-8 text-center">
          <Badge>Profile setup</Badge>

          <h1 className="mt-4 text-4xl font-black tracking-tight text-slate-950">
            Finish your profile
          </h1>

          <p className="mt-3 text-lg leading-8 text-slate-600">
            Add your languages, interests, and a short bio so other learners can
            understand what you want to practice.
          </p>
        </div>

        <Card className="p-7">
          <div className="mb-6 rounded-3xl bg-slate-50 p-5">
            <p className="text-sm font-black uppercase tracking-wide text-slate-400">
              Account details
            </p>

            <div className="mt-3">
              <p className="text-lg font-black text-slate-950">{fullname}</p>
            </div>
          </div>

          <form onSubmit={handleSubmit} noValidate className="space-y-6">
            <div className="grid gap-5 sm:grid-cols-2">
              <div>
                <Select
                  label="Native language"
                  options={languageOptions}
                  value={nativeLanguage}
                  onChange={(event) => {
                    setNativeLanguage(event.target.value);
                    clearFieldError("nativeLanguage");
                  }}
                  placeholder="Choose your native language"
                />
                <FieldWarning message={fieldErrors.nativeLanguage} />
              </div>

              <div>
                <Select
                  label="Target language"
                  options={languageOptions}
                  value={targetLanguage}
                  onChange={(event) => {
                    setTargetLanguage(event.target.value);
                    clearFieldError("targetLanguage");
                  }}
                  placeholder="Choose your target language"
                />
                <FieldWarning message={fieldErrors.targetLanguage} />
              </div>
            </div>

            <InterestSelector
              suggestedInterests={suggestedInterests}
              interests={interests}
              inputValue={interestInput}
              error={fieldErrors.interests}
              onInputChange={(value) => {
                setInterestInput(value);
                clearFieldError("interests");
              }}
              onAddInterest={addInterest}
              onRemoveInterest={removeInterest}
            />

            <div>
              <Textarea
                label="Bio"
                value={bio}
                onChange={(event) => {
                  setBio(event.target.value);
                  clearFieldError("bio");
                }}
                placeholder="Example: I want to practice English speaking and discuss technology, travel, and movies."
                rows={5}
              />
              <FieldWarning message={fieldErrors.bio} />
            </div>

            <FormAlert message={formError} />

            <Button type="submit" className="w-full" disabled={isSubmitting}>
              {isSubmitting ? "Saving profile..." : "Continue to dashboard"}
            </Button>
          </form>
        </Card>
      </div>
    </PageContainer>
  );
}