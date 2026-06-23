"use client";

import { useEffect, useRef, useState } from "react";

type SelectProps = {
  label?: string;
  options: string[];
  value?: string | null;
  onChange?: (event: { target: { value: string } }) => void;
  placeholder?: string;
  helperText?: string;
  error?: string;
  disabled?: boolean;
  className?: string;
};

export default function Select({
  label,
  options,
  value,
  onChange,
  placeholder = "Select an option",
  helperText,
  error,
  disabled = false,
  className = "",
}: SelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLLabelElement | null>(null);

  const selectedValue = value ?? "";
  const selectedLabel = selectedValue || placeholder;

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  function handleSelect(option: string) {
    onChange?.({ target: { value: option } });
    setIsOpen(false);
  }

  return (
    <label ref={containerRef} className={`relative block w-full ${className}`}>
      {label && (
        <span className="mb-2 block text-base font-bold text-slate-800">
          {label}
        </span>
      )}

      <button
        type="button"
        disabled={disabled}
        onClick={() => setIsOpen((current) => !current)}
        className={`flex min-h-14 w-full items-center justify-between rounded-2xl border bg-white px-5 py-3 text-left text-lg font-bold shadow-sm outline-none transition-all disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400 ${
          error
            ? "border-red-300 focus:ring-4 focus:ring-red-100"
            : "border-slate-200 hover:border-indigo-300 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100"
        } ${selectedValue ? "text-slate-900" : "text-slate-400"}`}
      >
        <span>{selectedLabel}</span>

        <svg
          className={`h-5 w-5 shrink-0 text-slate-400 transition-transform ${
            isOpen ? "rotate-180" : ""
          }`}
          viewBox="0 0 20 20"
          fill="none"
          aria-hidden="true"
        >
          <path
            d="M5 7.5L10 12.5L15 7.5"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>

      {isOpen && !disabled && (
        <div className="absolute z-50 mt-2 max-h-72 w-full overflow-hidden rounded-2xl border border-slate-200 bg-white p-2 shadow-xl shadow-slate-200/70">
          <div className="max-h-64 overflow-y-auto">
            <button
              type="button"
              onClick={() => handleSelect("")}
              className={`flex w-full items-center rounded-xl px-4 py-3 text-left text-base font-bold transition-colors ${
                selectedValue === ""
                  ? "bg-indigo-50 text-indigo-700"
                  : "text-slate-500 hover:bg-slate-50 hover:text-slate-900"
              }`}
            >
              {placeholder}
            </button>

            {options.map((option) => {
              const isSelected = option === selectedValue;

              return (
                <button
                  key={option}
                  type="button"
                  onClick={() => handleSelect(option)}
                  className={`mt-1 flex w-full items-center justify-between rounded-xl px-4 py-3 text-left text-base font-bold transition-colors ${
                    isSelected
                      ? "bg-indigo-50 text-indigo-700"
                      : "text-slate-700 hover:bg-slate-50 hover:text-slate-950"
                  }`}
                >
                  <span>{option}</span>

                  {isSelected && (
                    <span className="text-lg leading-none text-indigo-600">
                      ✓
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {helperText && !error && (
        <p className="mt-2 text-base leading-7 text-slate-500">{helperText}</p>
      )}

      {error && <p className="mt-2 text-base font-bold text-red-600">{error}</p>}
    </label>
  );
}