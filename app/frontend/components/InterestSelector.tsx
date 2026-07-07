"use client";

import type { KeyboardEvent } from "react";

import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";

type InterestSelectorProps = {
  suggestedInterests: string[];
  interests: string[];
  inputValue: string;
  error?: string;
  onInputChange: (value: string) => void;
  onAddInterest: (value: string) => void;
  onRemoveInterest: (value: string) => void;
};

function isSelected(interest: string, selectedInterests: string[]) {
  const normalizedInterest = interest.trim().toLowerCase();

  return selectedInterests.some(
    (selectedInterest) =>
      selectedInterest.trim().toLowerCase() === normalizedInterest,
  );
}

export default function InterestSelector({
  suggestedInterests,
  interests,
  inputValue,
  error,
  onInputChange,
  onAddInterest,
  onRemoveInterest,
}: InterestSelectorProps) {
  function handleInterestKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Enter") {
      event.preventDefault();
      onAddInterest(inputValue);
    }
  }

  return (
    <div>
      <label className="mb-3 block text-base font-bold text-slate-800">
        Interests
      </label>

      <div className="flex flex-col gap-3 sm:flex-row">
        <Input
          value={inputValue}
          onChange={(event) => onInputChange(event.target.value)}
          onKeyDown={handleInterestKeyDown}
          placeholder="Type interest and press Enter"
          error={error}
        />

        <Button
          type="button"
          variant="secondary"
          onClick={() => onAddInterest(inputValue)}
          disabled={!inputValue.trim()}
        >
          Add
        </Button>
      </div>

      <div className="mt-4 flex flex-wrap gap-3">
        {suggestedInterests.map((interest) => {
          const selected = isSelected(interest, interests);

          return (
            <button
              key={interest}
              type="button"
              aria-pressed={selected}
              onClick={() =>
                selected ? onRemoveInterest(interest) : onAddInterest(interest)
              }
              className={`rounded-full border px-4 py-2 text-base font-black transition-all ${
                selected
                  ? "border-emerald-600 bg-emerald-600 text-white shadow-sm shadow-emerald-100 hover:bg-emerald-700"
                  : "border-slate-200 bg-white text-slate-600 hover:border-indigo-200 hover:bg-indigo-50 hover:text-indigo-700"
              }`}
            >
              {selected ? "✓" : "+"} {interest}
            </button>
          );
        })}
      </div>

      {interests.length > 0 && (
        <div className="mt-5 rounded-3xl border border-emerald-100 bg-emerald-50 p-4">
          <p className="text-xs font-black uppercase tracking-wide text-emerald-700">
            Selected interests
          </p>

          <div className="mt-3 flex flex-wrap gap-3">
            {interests.map((interest) => (
              <button
                key={interest}
                type="button"
                onClick={() => onRemoveInterest(interest)}
                className="rounded-full bg-emerald-600 px-4 py-2 text-base font-black text-white shadow-sm shadow-emerald-100 ring-1 ring-emerald-500 transition-colors hover:bg-emerald-700"
                aria-label={`Remove ${interest}`}
              >
                {interest} ×
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
