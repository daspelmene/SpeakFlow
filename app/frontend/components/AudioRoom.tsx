"use client";

import { useEffect, useState } from "react";
import { useAudioRoom } from "@/hooks/useAudioRoom";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";

// ------------------------------------------------------------------
// Status badge colors
// ------------------------------------------------------------------

const statusColors: Record<string, string> = {
  idle: "bg-slate-100 text-slate-600",
  creating: "bg-amber-100 text-amber-700",
  waiting: "bg-sky-100 text-sky-700",
  active: "bg-emerald-100 text-emerald-700",
  ended: "bg-slate-100 text-slate-600",
};

const statusLabels: Record<string, string> = {
  idle: "Не в звонке",
  creating: "Создание комнаты…",
  waiting: "Ожидание собеседника…",
  active: "Разговор",
  ended: "Звонок завершён",
};

// ------------------------------------------------------------------
// Component
// ------------------------------------------------------------------

type AudioRoomProps = {
  /** Pre-set room ID to join on mount (e.g. from invitation) */
  initialRoomId?: string;
  /** Called when call ends */
  onEnd?: () => void;
};

export default function AudioRoom({ initialRoomId, onEnd }: AudioRoomProps) {
  const {
    status,
    roomId,
    participants,
    isMuted,
    error,
    remoteAudioElement,
    createRoom,
    joinRoom,
    leaveRoom,
    toggleMute,
  } = useAudioRoom();

  const [showJoinInput, setShowJoinInput] = useState(false);
  const [joinCode, setJoinCode] = useState("");
  const [copied, setCopied] = useState(false);

  // Ensure remote audio plays when the element is ready.
  // WSAudioClient creates its own Audio element with MediaSource URL —
  // it plays through the default audio output without needing to be in the DOM.
  useEffect(() => {
    if (remoteAudioElement) {
      remoteAudioElement.play().catch(() => {
        // Autoplay may be blocked until user interaction
      });
    }
  }, [remoteAudioElement]);

  // Auto-join if initialRoomId provided
  useEffect(() => {
    if (initialRoomId && status === "idle") {
      joinRoom(initialRoomId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialRoomId]);

  // Call onEnd when status becomes "ended"
  useEffect(() => {
    if (status === "ended" && onEnd) onEnd();
  }, [status, onEnd]);

  const handleCopyCode = async () => {
    if (!roomId) return;
    try {
      await navigator.clipboard.writeText(roomId);
      setCopied(true);
    } catch {
      // Fallback: select text manually
      const el = document.querySelector("[data-room-code]") as HTMLElement | null;
      if (el) {
        const range = document.createRange();
        range.selectNodeContents(el);
        const sel = window.getSelection();
        sel?.removeAllRanges();
        sel?.addRange(range);
      }
    }
  };

  // Reset join input when leaving idle
  useEffect(() => {
    if (status !== "idle") {
      setShowJoinInput(false);
      setJoinCode("");
    }
  }, [status]);

  // Reset "copied" badge after 2 seconds
  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(false), 2000);
    return () => clearTimeout(timer);
  }, [copied]);

  const handleJoinSubmit = () => {
    const code = joinCode.trim();
    if (code) {
      joinRoom(code);
    }
  };

  return (
    <Card className="flex flex-col gap-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-bold text-slate-900">🎙️ Аудио-комната</h3>
        <span
          className={`rounded-full px-3 py-1 text-xs font-semibold ${statusColors[status] || statusColors.idle}`}
        >
          {statusLabels[status] || status}
        </span>
      </div>

      {/* Room ID */}
      {roomId && (
        <div className="rounded-xl bg-slate-50 px-4 py-3 text-center">
          <p className="text-xs font-medium text-slate-500">Код комнаты</p>
          <p
            data-room-code
            className="mt-1 font-mono text-2xl font-bold tracking-widest text-slate-900"
          >
            {roomId}
          </p>
          <button
            onClick={handleCopyCode}
            className="mt-2 inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium text-slate-600 transition-colors hover:bg-slate-200 hover:text-slate-900"
          >
            {copied ? "✅ Скопировано!" : "📋 Скопировать код"}
          </button>
          <p className="mt-1 text-xs text-slate-400">
            Поделитесь этим кодом с собеседником
          </p>
        </div>
      )}

      {/* Join room input */}
      {status === "idle" && showJoinInput && (
        <div className="flex flex-col gap-3 rounded-xl bg-slate-50 p-4">
          <label className="text-sm font-medium text-slate-600">
            Введите код комнаты:
          </label>
          <input
            type="text"
            value={joinCode}
            onChange={(e) => setJoinCode(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleJoinSubmit();
            }}
            placeholder="Например: a1b2c3d4"
            maxLength={8}
            className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 font-mono text-lg tracking-widest text-slate-900 placeholder:text-slate-300 focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100"
            autoFocus
          />
          <div className="flex gap-2">
            <Button onClick={handleJoinSubmit} size="md">
              📞 Войти
            </Button>
            <Button
              onClick={() => {
                setShowJoinInput(false);
                setJoinCode("");
              }}
              variant="ghost"
              size="md"
            >
              Отмена
            </Button>
          </div>
        </div>
      )}

      {/* Participants */}
      {participants.length > 0 && (
        <div className="flex flex-col gap-2">
          <p className="text-sm font-medium text-slate-600">Участники:</p>
          {participants.map((p) => (
            <div
              key={p.slot}
              className="flex items-center gap-2 rounded-xl bg-slate-50 px-4 py-2"
            >
              <span className="text-lg">👤</span>
              <span className="text-sm font-medium text-slate-800">
                {p.name || `Участник (${p.slot})`}
              </span>
              {p.slot === "user1" && (
                <span className="ml-auto rounded-full bg-indigo-100 px-2 py-0.5 text-xs text-indigo-600">
                  Создатель
                </span>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Error message */}
      {error && (
        <div className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">
          ❌ {error}
        </div>
      )}

      {/* Controls */}
      <div className="flex flex-wrap gap-3">
        {status === "idle" && !showJoinInput && (
          <>
            <Button onClick={createRoom} variant="primary">
              📞 Создать комнату
            </Button>
            <Button onClick={() => setShowJoinInput(true)} variant="secondary">
              🔗 Войти по коду
            </Button>
          </>
        )}

        {status === "active" && (
          <>
            <Button
              onClick={toggleMute}
              variant={isMuted ? "danger" : "secondary"}
            >
              {isMuted ? "🔇 Включить микрофон" : "🎤 Выключить микрофон"}
            </Button>
            <Button onClick={leaveRoom} variant="danger">
              📞 Завершить звонок
            </Button>
          </>
        )}

        {(status === "waiting") && (
          <Button onClick={leaveRoom} variant="ghost">
            ✕ Отменить
          </Button>
        )}

        {status === "ended" && (
          <Button onClick={leaveRoom} variant="secondary">
            Закрыть
          </Button>
        )}
      </div>
    </Card>
  );
}
