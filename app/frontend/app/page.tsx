import Link from "next/link";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import PageContainer from "@/components/layout/PageContainer";

export default function HomePage() {
  return (
    <PageContainer>
      <section className="grid gap-10 py-16 lg:grid-cols-2 lg:items-center">
        <div>
          <Badge variant="info">Guided speaking practice</Badge>

          <h1 className="mt-6 text-4xl font-bold tracking-tight text-slate-900 sm:text-5xl">
            Practice foreign languages with structured audio sessions.
          </h1>

          <p className="mt-6 max-w-xl text-lg leading-8 text-slate-600">
            SpeakFlow helps language learners find partners, follow guided
            conversation scenarios, switch roles, use timers, and collect
            correction notes after every speaking session.
          </p>

          <div className="mt-8 flex gap-3">
            <Link href="/register">
              <Button>Get started</Button>
            </Link>
            <Link href="/login">
              <Button variant="secondary">Login</Button>
            </Link>
          </div>
        </div>

        <Card className="space-y-4">
          <div className="rounded-xl bg-indigo-50 p-4">
            <p className="text-sm font-medium text-indigo-700">
              Example guided session
            </p>
            <h2 className="mt-2 text-2xl font-bold text-slate-900">
              University Life Discussion
            </h2>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-xl border border-slate-200 p-4">
              <p className="text-sm text-slate-500">Role</p>
              <p className="font-semibold text-slate-900">Learner</p>
            </div>
            <div className="rounded-xl border border-slate-200 p-4">
              <p className="text-sm text-slate-500">Timer</p>
              <p className="font-semibold text-amber-600">05:00</p>
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 p-4">
            <p className="text-sm font-medium text-slate-700">Topic card</p>
            <p className="mt-2 text-sm text-slate-600">
              Tell your partner about your university, your favorite subject,
              and one challenge you faced while studying.
            </p>
          </div>
        </Card>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        <Card>
          <h3 className="font-semibold text-slate-900">Guided sessions</h3>
          <p className="mt-2 text-sm text-slate-600">
            Users follow clear stages, topics, questions, and useful phrases.
          </p>
        </Card>

        <Card>
          <h3 className="font-semibold text-slate-900">Balanced roles</h3>
          <p className="mt-2 text-sm text-slate-600">
            Learner and helper roles make speaking time fair for both users.
          </p>
        </Card>

        <Card>
          <h3 className="font-semibold text-slate-900">Correction notes</h3>
          <p className="mt-2 text-sm text-slate-600">
            Helpers can save useful corrections during the speaking session.
          </p>
        </Card>
      </section>
    </PageContainer>
  );
}