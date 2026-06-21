"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

import PageContainer from "@/components/layout/PageContainer";
import Badge from "@/components/ui/Badge";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import { getCurrentUser, type UserMe } from "@/lib/api";
import { getAccessToken } from "@/lib/auth";

const MOCK_PROFILE_KEY = "speakflow_mock_profile_setup";

type ProfileView = {
  fullname: string;
  native_language: string;
  target_language: string;
  interests: string[];
  bio: string | null;
};

function getInitials(name: string) {
  return name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function mapUserToProfile(user: UserMe): ProfileView {
  return {
    fullname: user.fullname,
    native_language: user.native_language || "Not selected",
    target_language: user.target_language || "Not selected",
    interests: user.interests || [],
    bio: user.bio,
  };
}

export default function ProfilePage() {
  const [profile, setProfile] = useState<ProfileView | null>(null);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isMockMode, setIsMockMode] = useState(false);

  useEffect(() => {
    async function loadProfile() {
      const token = getAccessToken();

      if (!token) {
        setIsMockMode(true);

        const savedMockProfile = localStorage.getItem(MOCK_PROFILE_KEY);

        if (savedMockProfile) {
          const parsedProfile = JSON.parse(savedMockProfile);

          setProfile({
            fullname: parsedProfile.fullname || "Demo User",
            native_language: parsedProfile.native_language || "Not selected",
            target_language: parsedProfile.target_language || "Not selected",
            interests: parsedProfile.interests || [],
            bio: parsedProfile.bio || null,
          });
        } else {
          setProfile({
            fullname: "Demo User",
            native_language: "Not selected",
            target_language: "Not selected",
            interests: [],
            bio: null,
          });
        }

        setIsLoading(false);
        return;
      }

      try {
        const user = await getCurrentUser();
        setProfile(mapUserToProfile(user));
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

  if (error || !profile) {
    return (
      <PageContainer>
        <Card className="p-8">
          <Badge variant="error">Profile error</Badge>
          <h1 className="mt-5 text-3xl font-black text-slate-950">
            Could not load profile
          </h1>
          <p className="mt-3 text-lg leading-8 text-slate-600">
            {error || "Profile data is unavailable."}
          </p>
          <Link href="/profile/setup" className="mt-6 inline-block">
            <Button>Edit profile</Button>
          </Link>
        </Card>
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      <div className="mb-10 flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <Badge variant={isMockMode ? "warning" : "info"}>
            {isMockMode ? "Demo profile" : "Profile"}
          </Badge>

          <h1 className="mt-5 text-5xl font-black tracking-tight text-slate-950">
            Your speaking profile
          </h1>

          <p className="mt-5 max-w-3xl text-xl leading-9 text-slate-600">
            This profile helps SpeakFlow suggest suitable partners for guided
            language practice.
          </p>
        </div>

        <Link href="/profile/setup">
          <Button size="lg">Edit profile</Button>
        </Link>
      </div>

      <section className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
        <Card className="p-8">
          <div className="flex items-center gap-5">
            <div className="flex h-20 w-20 items-center justify-center rounded-3xl bg-indigo-600 text-3xl font-black text-white shadow-sm shadow-indigo-200">
              {getInitials(profile.fullname)}
            </div>

            <div>
              <h2 className="text-4xl font-black tracking-tight text-slate-950">
                {profile.fullname}
              </h2>

              <p className="mt-2 text-xl font-semibold text-slate-600">
                Language learner
              </p>
            </div>
          </div>

          <div className="mt-8 grid gap-4">
            <div className="rounded-3xl border border-slate-200 bg-slate-50 p-5">
              <p className="text-base font-black uppercase tracking-wide text-slate-400">
                Native language
              </p>
              <p className="mt-2 text-2xl font-black text-slate-950">
                {profile.native_language}
              </p>
            </div>

            <div className="rounded-3xl border border-slate-200 bg-slate-50 p-5">
              <p className="text-base font-black uppercase tracking-wide text-slate-400">
                Target language
              </p>
              <p className="mt-2 text-2xl font-black text-indigo-700">
                {profile.target_language}
              </p>
            </div>
          </div>
        </Card>

        <Card className="p-8">
          <h2 className="text-4xl font-black tracking-tight text-slate-950">
            Practice information
          </h2>

          <p className="mt-5 text-xl leading-9 text-slate-600">
            SpeakFlow uses your languages, interests, and bio to find partners
            with useful conversation overlap.
          </p>

          <div className="mt-8">
            <h3 className="text-2xl font-black text-slate-950">Interests</h3>

            {profile.interests.length > 0 ? (
              <div className="mt-4 flex flex-wrap gap-3">
                {profile.interests.map((interest) => (
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
              {profile.bio || "No bio added yet."}
            </p>
          </div>

          <div className="mt-8 rounded-3xl border border-emerald-100 bg-emerald-50 p-6">
            <Badge variant="success">Matching summary</Badge>

            <p className="mt-4 text-xl leading-9 text-emerald-900">
              You can help others with {profile.native_language} and practice{" "}
              {profile.target_language} with suitable partners.
            </p>
          </div>
        </Card>
      </section>
    </PageContainer>
  );
}