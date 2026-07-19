"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";

import Button from "@/components/ui/Button";
import { getAccessToken } from "@/lib/auth";
import {
  hasCompletedOnboardingTutorial,
  markOnboardingTutorialCompleted,
  OPEN_ONBOARDING_TUTORIAL_EVENT,
} from "@/lib/tutorial";

type TutorialStep = {
  label: string;
  title: string;
  description: string;
  tips: string[];
  previewTitle: string;
  previewDescription: string;
  previewItems: Array<{
    title: string;
    description: string;
    badge?: string;
  }>;
};

const tutorialSteps: TutorialStep[] = [
  {
    label: "Step 1 · Dashboard",
    title: "Start your first speaking session",
    description:
      "You are already signed in and your learning profile is ready. From the dashboard, find a matched learner, invite someone by email, or accept an incoming invitation.",
    tips: [
      "Use Profile at any time to update your languages, interests, or bio.",
      "Incoming invitations refresh automatically and can be accepted or declined.",
    ],
    previewTitle: "Main dashboard actions",
    previewDescription:
      "Use the option that fits how you want to practice today.",
    previewItems: [
      {
        badge: "Find partner",
        title: "Automatic match",
        description: "Create a room with a suitable available learner.",
      },
      {
        badge: "Send invitation",
        title: "Invite by email",
        description: "Start a room with a specific SpeakFlow user.",
      },
      {
        badge: "Join room",
        title: "Accept an invitation",
        description: "Open a room created by another learner.",
      },
    ],
  },
  {
    label: "Step 2 · Audio room",
    title: "Connect and wait for your partner",
    description:
      "The session page joins the audio room automatically. Allow microphone access, check the room status, and wait until both participants are connected.",
    tips: [
      "Use Mute microphone whenever you need privacy during the call.",
      "The guided content unlocks after both learners join the room.",
    ],
    previewTitle: "Waiting room controls",
    previewDescription:
      "Room status and microphone controls stay visible throughout the call.",
    previewItems: [
      {
        badge: "Waiting",
        title: "Room status",
        description: "See whether the room is connecting, waiting, active, or finished.",
      },
      {
        badge: "Mic",
        title: "Microphone control",
        description: "Mute or unmute without leaving the session.",
      },
      {
        badge: "Participants",
        title: "Partner presence",
        description: "Check who is connected and whether their microphone is active.",
      },
    ],
  },
  {
    label: "Step 3 · Guided practice",
    title: "Follow your role and the topic cards",
    description:
      "When the room becomes active, SpeakFlow assigns Helper and Learner roles and shows structured prompts for the conversation.",
    tips: [
      "The Helper asks questions and writes short correction notes.",
      "The Learner answers, practices speaking, and can use vocabulary hints.",
    ],
    previewTitle: "During the conversation",
    previewDescription:
      "The session tools keep the practice focused without interrupting the call.",
    previewItems: [
      {
        badge: "Role",
        title: "Helper or Learner",
        description: "Follow the responsibilities shown for your current role.",
      },
      {
        badge: "Topic",
        title: "Questions and prompts",
        description: "Use the guided cards to keep the conversation moving.",
      },
      {
        badge: "Notes",
        title: "Corrections and vocabulary",
        description: "Save useful corrections or open suggested words when needed.",
      },
    ],
  },
  {
    label: "Step 4 · Review",
    title: "Finish the call and keep what you learned",
    description:
      "Leave the room when the practice is complete, save feedback for your partner, and review correction notes from completed sessions.",
    tips: [
      "Previous notes and feedback are available from Dashboard and History.",
      "Open this tutorial again at any time with the Help button in the header.",
    ],
    previewTitle: "After the session",
    previewDescription:
      "SpeakFlow keeps the useful parts of the conversation available for review.",
    previewItems: [
      {
        badge: "Leave room",
        title: "Complete the audio session",
        description: "End your participation when the conversation is finished.",
      },
      {
        badge: "Feedback",
        title: "Share a short review",
        description: "Save constructive feedback for your speaking partner.",
      },
      {
        badge: "History",
        title: "Revisit corrections",
        description: "Review notes and feedback from previous practice sessions.",
      },
    ],
  },
];

function TutorialIcon({ stepIndex }: { stepIndex: number }) {
  const iconClassName = "h-9 w-9";

  if (stepIndex === 0) {
    return (
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        className={iconClassName}
        aria-hidden="true"
      >
        <rect x="3" y="4" width="18" height="16" rx="2" />
        <path d="M3 9h18M8 4v5" />
      </svg>
    );
  }

  if (stepIndex === 1) {
    return (
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        className={iconClassName}
        aria-hidden="true"
      >
        <rect x="9" y="2" width="6" height="12" rx="3" />
        <path d="M5 10a7 7 0 0 0 14 0M12 17v5M8 22h8" />
      </svg>
    );
  }

  if (stepIndex === 2) {
    return (
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        className={iconClassName}
        aria-hidden="true"
      >
        <path d="M4 5h16v11H7l-3 3V5Z" />
        <path d="M8 9h8M8 12h5" />
      </svg>
    );
  }

  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      className={iconClassName}
      aria-hidden="true"
    >
      <path d="m5 12 4 4L19 6" />
      <circle cx="12" cy="12" r="10" />
    </svg>
  );
}

export default function OnboardingTutorial() {
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(false);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const dialogRef = useRef<HTMLDivElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  const currentStep = tutorialSteps[currentStepIndex];
  const isLastStep = currentStepIndex === tutorialSteps.length - 1;

  useEffect(() => {
    function handleOpenTutorial() {
      setCurrentStepIndex(0);
      setIsOpen(true);
    }

    window.addEventListener(
      OPEN_ONBOARDING_TUTORIAL_EVENT,
      handleOpenTutorial,
    );

    return () => {
      window.removeEventListener(
        OPEN_ONBOARDING_TUTORIAL_EVENT,
        handleOpenTutorial,
      );
    };
  }, []);

  useEffect(() => {
    if (
      pathname !== "/dashboard" ||
      !getAccessToken() ||
      hasCompletedOnboardingTutorial()
    ) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      setCurrentStepIndex(0);
      setIsOpen(true);
    }, 350);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [pathname]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    previousFocusRef.current = document.activeElement as HTMLElement | null;
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const animationFrameId = window.requestAnimationFrame(() => {
      dialogRef.current?.focus();
    });

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        markOnboardingTutorialCompleted();
        setIsOpen(false);
        return;
      }

      if (event.key !== "Tab" || !dialogRef.current) {
        return;
      }

      const focusableElements = Array.from(
        dialogRef.current.querySelectorAll<HTMLElement>(
          'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ),
      );

      if (focusableElements.length === 0) {
        event.preventDefault();
        return;
      }

      const firstElement = focusableElements[0];
      const lastElement = focusableElements[focusableElements.length - 1];

      if (event.shiftKey && document.activeElement === firstElement) {
        event.preventDefault();
        lastElement.focus();
      } else if (!event.shiftKey && document.activeElement === lastElement) {
        event.preventDefault();
        firstElement.focus();
      }
    }

    document.addEventListener("keydown", handleKeyDown);

    return () => {
      window.cancelAnimationFrame(animationFrameId);
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = originalOverflow;
      previousFocusRef.current?.focus();
    };
  }, [isOpen]);

  function closeTutorial() {
    markOnboardingTutorialCompleted();
    setIsOpen(false);
  }

  function goToPreviousStep() {
    setCurrentStepIndex((currentIndex) => Math.max(0, currentIndex - 1));
  }

  function goToNextStep() {
    if (isLastStep) {
      closeTutorial();
      return;
    }

    setCurrentStepIndex((currentIndex) =>
      Math.min(tutorialSteps.length - 1, currentIndex + 1),
    );
  }

  if (!isOpen) {
    return null;
  }

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm sm:p-6"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          closeTutorial();
        }
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="onboarding-tutorial-title"
        aria-describedby="onboarding-tutorial-description"
        tabIndex={-1}
        className="max-h-[calc(100vh-2rem)] w-full max-w-5xl overflow-y-auto rounded-3xl border border-white/70 bg-white shadow-2xl outline-none sm:max-h-[calc(100vh-3rem)]"
      >
        <div className="border-b border-slate-200 px-5 py-4 sm:px-7">
          <div className="flex items-center justify-between gap-4">
            <div className="flex min-w-0 items-center gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-indigo-600 text-lg font-black text-white">
                S
              </div>

              <div className="min-w-0">
                <p className="truncate text-lg font-black text-slate-950">
                  SpeakFlow tutorial
                </p>
                <p className="text-sm font-semibold text-slate-500">
                  {currentStepIndex + 1} of {tutorialSteps.length}
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={closeTutorial}
              className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl text-2xl font-semibold text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-950 focus:outline-none focus:ring-4 focus:ring-indigo-100"
              aria-label="Close tutorial"
            >
              ×
            </button>
          </div>

          <div
            className="mt-4 flex gap-2"
            aria-label={`Tutorial progress: step ${currentStepIndex + 1} of ${tutorialSteps.length}`}
          >
            {tutorialSteps.map((step, index) => (
              <button
                key={step.label}
                type="button"
                onClick={() => setCurrentStepIndex(index)}
                className={`h-2 flex-1 rounded-full transition-colors focus:outline-none focus:ring-4 focus:ring-indigo-100 ${
                  index <= currentStepIndex ? "bg-indigo-600" : "bg-slate-200"
                }`}
                aria-label={`Open ${step.label}`}
                aria-current={index === currentStepIndex ? "step" : undefined}
              />
            ))}
          </div>
        </div>

        <div className="grid gap-0 lg:grid-cols-[0.9fr_1.1fr]">
          <section className="p-6 sm:p-8 lg:border-r lg:border-slate-200">
            <div className="flex h-16 w-16 items-center justify-center rounded-3xl bg-indigo-50 text-indigo-700 ring-1 ring-indigo-100">
              <TutorialIcon stepIndex={currentStepIndex} />
            </div>

            <p className="mt-6 text-sm font-black uppercase tracking-[0.16em] text-indigo-600">
              {currentStep.label}
            </p>

            <h2
              id="onboarding-tutorial-title"
              className="mt-3 text-3xl font-black tracking-tight text-slate-950 sm:text-4xl"
            >
              {currentStep.title}
            </h2>

            <p
              id="onboarding-tutorial-description"
              className="mt-4 text-lg leading-8 text-slate-600"
            >
              {currentStep.description}
            </p>

            <div className="mt-6 space-y-3">
              {currentStep.tips.map((tip) => (
                <div key={tip} className="flex gap-3">
                  <span className="mt-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-sm font-black text-emerald-700">
                    ✓
                  </span>
                  <p className="text-base leading-7 text-slate-700">{tip}</p>
                </div>
              ))}
            </div>
          </section>

          <section className="bg-slate-50 p-6 sm:p-8">
            <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
              <p className="text-sm font-black uppercase tracking-[0.14em] text-slate-400">
                Interface guide
              </p>

              <h3 className="mt-3 text-2xl font-black text-slate-950">
                {currentStep.previewTitle}
              </h3>

              <p className="mt-2 text-base leading-7 text-slate-600">
                {currentStep.previewDescription}
              </p>

              <div className="mt-5 space-y-3">
                {currentStep.previewItems.map((item) => (
                  <div
                    key={item.title}
                    className="rounded-2xl border border-slate-200 bg-slate-50 p-4"
                  >
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
                      {item.badge && (
                        <span className="inline-flex w-fit shrink-0 rounded-xl bg-indigo-100 px-3 py-1.5 text-sm font-black text-indigo-700">
                          {item.badge}
                        </span>
                      )}

                      <div>
                        <p className="text-lg font-black text-slate-950">
                          {item.title}
                        </p>
                        <p className="mt-1 text-sm leading-6 text-slate-600">
                          {item.description}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>
        </div>

        <div className="flex flex-col-reverse gap-3 border-t border-slate-200 px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-7">
          <button
            type="button"
            onClick={closeTutorial}
            className="min-h-12 rounded-2xl px-5 py-3 text-base font-black text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-950 focus:outline-none focus:ring-4 focus:ring-indigo-100"
          >
            Skip tutorial
          </button>

          <div className="flex gap-3">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={goToPreviousStep}
              disabled={currentStepIndex === 0}
              className="flex-1 sm:flex-none"
            >
              Back
            </Button>

            <Button
              type="button"
              size="sm"
              onClick={goToNextStep}
              className="flex-1 sm:flex-none"
            >
              {isLastStep ? "Finish" : "Next"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
