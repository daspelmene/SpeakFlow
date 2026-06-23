import Link from "next/link";

import PageContainer from "@/components/layout/PageContainer";
import Badge from "@/components/ui/Badge";
import Card from "@/components/ui/Card";

export default function Home() {
  return (
    <PageContainer>
      <section className="grid min-h-[calc(100vh-120px)] items-center gap-10 py-8 lg:grid-cols-[1.05fr_0.95fr]">
        <div>
          <Badge variant="info">Guided speaking practice</Badge>

          <h1 className="mt-6 max-w-4xl text-4xl font-black tracking-tight text-slate-950 sm:text-5xl lg:text-6xl">
            Practice foreign languages with structured audio sessions.
          </h1>

          <p className="mt-6 max-w-3xl text-xl leading-9 text-slate-600">
            SpeakFlow helps language learners find partners, follow guided
            conversation scenarios, switch roles, use timers, and collect
            correction notes after every speaking session.
          </p>

          <div className="mt-8 flex flex-wrap gap-4">
            <Link
              href="/register"
              className="inline-flex min-h-13 items-center justify-center rounded-2xl bg-indigo-600 px-6 py-3.5 text-lg font-black text-white shadow-sm shadow-indigo-200 transition-colors hover:bg-indigo-700"
            >
              Get started
            </Link>

            <Link
              href="/login"
              className="inline-flex min-h-13 items-center justify-center rounded-2xl border border-slate-200 bg-white px-6 py-3.5 text-lg font-black text-slate-800 shadow-sm transition-colors hover:bg-slate-50"
            >
              Login
            </Link>
          </div>
        </div>

        <Card className="p-7">
          <div className="rounded-3xl bg-indigo-50 p-6">
            <Badge variant="success">Example guided session</Badge>

            <h2 className="mt-5 text-3xl font-black tracking-tight text-slate-950">
              University Life Discussion
            </h2>

            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              <div className="rounded-2xl bg-white p-5 shadow-sm">
                <p className="text-base font-black uppercase tracking-wide text-slate-400">
                  Role
                </p>
                <p className="mt-2 text-xl font-black text-slate-950">
                  Learner
                </p>
              </div>

              <div className="rounded-2xl bg-white p-5 shadow-sm">
                <p className="text-base font-black uppercase tracking-wide text-slate-400">
                  Timer
                </p>
                <p className="mt-2 text-xl font-black text-indigo-700">
                  05:00
                </p>
              </div>
            </div>

            <div className="mt-5 rounded-3xl border border-indigo-100 bg-white p-6 shadow-sm">
              <p className="text-base font-black uppercase tracking-wide text-indigo-500">
                Topic card
              </p>

              <p className="mt-4 text-xl font-black leading-8 text-slate-950">
                Tell your partner about your university, your favorite subject,
                and one challenge you faced while studying.
              </p>
            </div>
          </div>

          <div className="mt-6 grid gap-4">
            <div className="rounded-3xl border border-slate-200 bg-white p-6">
              <h3 className="text-2xl font-black text-slate-950">
                Guided sessions
              </h3>
              <p className="mt-3 text-lg leading-8 text-slate-600">
                Users follow clear stages, topics, questions, and useful
                phrases.
              </p>
            </div>

            <div className="rounded-3xl border border-slate-200 bg-white p-6">
              <h3 className="text-2xl font-black text-slate-950">
                Balanced roles
              </h3>
              <p className="mt-3 text-lg leading-8 text-slate-600">
                Both partners get time to speak, listen, help, and receive
                feedback.
              </p>
            </div>

            <div className="rounded-3xl border border-slate-200 bg-white p-6">
              <h3 className="text-2xl font-black text-slate-950">
                Correction notes
              </h3>
              <p className="mt-3 text-lg leading-8 text-slate-600">
                Helpers can save useful corrections so learners can review them
                later.
              </p>
            </div>
          </div>
        </Card>
      </section>
    </PageContainer>
  );
}