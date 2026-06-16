import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import PageContainer from "@/components/layout/PageContainer";
import { mockProfile } from "@/lib/mockData";

export default function ProfilePage() {
  return (
    <PageContainer>
      <div className="mb-8">
        <Badge variant="info">Profile preview</Badge>
        <h1 className="mt-4 text-3xl font-bold text-slate-900">
          Your speaking profile
        </h1>
        <p className="mt-2 max-w-2xl text-slate-600">
          This profile will be used to match you with suitable language partners
          based on your native language, target language, level, country, and
          interests.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <div className="flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h2 className="text-2xl font-bold text-slate-900">
                {mockProfile.name}
              </h2>
              <p className="mt-1 text-slate-600">{mockProfile.country}</p>
            </div>

            <Badge variant="success">{mockProfile.level}</Badge>
          </div>

          <div className="mt-8 grid gap-4 sm:grid-cols-2">
            <div className="rounded-xl border border-slate-200 p-4">
              <p className="text-sm text-slate-500">Native language</p>
              <p className="mt-1 font-semibold text-slate-900">
                {mockProfile.nativeLanguage}
              </p>
            </div>

            <div className="rounded-xl border border-slate-200 p-4">
              <p className="text-sm text-slate-500">Target language</p>
              <p className="mt-1 font-semibold text-slate-900">
                {mockProfile.targetLanguage}
              </p>
            </div>

            <div className="rounded-xl border border-slate-200 p-4 sm:col-span-2">
              <p className="text-sm text-slate-500">Interests</p>
              <p className="mt-1 font-semibold text-slate-900">
                {mockProfile.interests}
              </p>
            </div>

            <div className="rounded-xl border border-slate-200 p-4 sm:col-span-2">
              <p className="text-sm text-slate-500">Bio</p>
              <p className="mt-1 text-slate-700">{mockProfile.bio}</p>
            </div>
          </div>

          <div className="mt-6 flex gap-3">
            <Button>Edit profile</Button>
            <Button variant="secondary">Find partner using this profile</Button>
          </div>
        </Card>

        <Card>
          <h2 className="text-lg font-semibold text-slate-900">
            Matching summary
          </h2>

          <div className="mt-4 space-y-4">
            <div>
              <p className="text-sm text-slate-500">Can help with</p>
              <p className="font-medium text-slate-900">
                {mockProfile.nativeLanguage}
              </p>
            </div>

            <div>
              <p className="text-sm text-slate-500">Wants to practice</p>
              <p className="font-medium text-slate-900">
                {mockProfile.targetLanguage}
              </p>
            </div>

            <div>
              <p className="text-sm text-slate-500">Recommended partner type</p>
              <p className="font-medium text-slate-900">
                Native {mockProfile.targetLanguage} speaker
              </p>
            </div>
          </div>
        </Card>
      </div>
    </PageContainer>
  );
}