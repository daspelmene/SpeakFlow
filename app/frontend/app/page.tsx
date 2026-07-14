import Link from "next/link";

import PageContainer from "@/components/layout/PageContainer";
import Badge from "@/components/ui/Badge";
import Card from "@/components/ui/Card";

export default function Home() {
  return (
    <PageContainer>
      <section className="grid min-h-[calc(100dvh-141px)] items-center gap-8 py-5 lg:grid-cols-[1.18fr_0.82fr]">
        <div>
          <Badge variant="info">Guided speaking practice</Badge>

          <h1 className="mt-5 max-w-4xl text-4xl font-black tracking-tight text-slate-950 sm:text-5xl lg:text-6xl">
            Practice foreign languages with structured audio sessions.
          </h1>

          <p className="mt-5 max-w-3xl text-xl leading-9 text-slate-600">
            SpeakFlow helps language learners find partners, follow guided
            conversation scenarios, switch roles, use timers, and collect
            correction notes after every speaking session.
          </p>

          <div className="mt-7 flex flex-wrap gap-4">
            <Link
              href="/register"
              className="inline-flex min-h-[50px] items-center justify-center rounded-2xl bg-indigo-600 px-6 py-3 text-lg font-black text-white shadow-sm shadow-indigo-200 transition-colors hover:bg-indigo-700"
            >
              Get started
            </Link>

            <Link
              href="/login"
              className="inline-flex min-h-[50px] items-center justify-center rounded-2xl border border-slate-200 bg-white px-6 py-3 text-lg font-black text-slate-800 shadow-sm transition-colors hover:bg-slate-50"
            >
              Login
            </Link>
          </div>
        </div>

        <Card className="p-5">
          <Badge variant="success">Simple session flow</Badge>

          <h2 className="mt-4 text-3xl font-black tracking-tight text-slate-950">
            From match to useful notes
          </h2>

          <p className="mt-3 text-base leading-7 text-slate-600">
            The interface focuses on the main actions learners need before,
            during, and after speaking practice.
          </p>

          <div className="mt-5 grid gap-3">
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-sm font-black uppercase tracking-wide text-indigo-500">
                Step 1
              </p>

              <h3 className="mt-2 text-xl font-black text-slate-950">
                Find a partner
              </h3>

              <p className="mt-1 text-base leading-7 text-slate-600">
                Match with another learner by language goals and interests.
              </p>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-sm font-black uppercase tracking-wide text-indigo-500">
                Step 2
              </p>

              <h3 className="mt-2 text-xl font-black text-slate-950">
                Join the audio room
              </h3>

              <p className="mt-1 text-base leading-7 text-slate-600">
                Follow topic cards and keep the conversation structured.
              </p>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-sm font-black uppercase tracking-wide text-indigo-500">
                Step 3
              </p>

              <h3 className="mt-2 text-xl font-black text-slate-950">
                Review corrections
              </h3>

              <p className="mt-1 text-base leading-7 text-slate-600">
                Save helpful feedback and review notes from previous sessions.
              </p>
            </div>
          </div>
        </Card>
      </section>
    </PageContainer>
  );
}
