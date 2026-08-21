"use client";

// The real schedule reader. Downscales the photo in the browser, sends it
// to /api/ai/schedule, and Claude reads the dates into sports_events.

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";

function fileToResizedBase64(
  file: File,
  maxDim = 1568
): Promise<{ data: string; media_type: string }> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      const ctx = canvas.getContext("2d");
      if (!ctx) return reject(new Error("no canvas"));
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      const dataUrl = canvas.toDataURL("image/jpeg", 0.82);
      resolve({ data: dataUrl.split(",")[1], media_type: "image/jpeg" });
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("could not read image"));
    };
    img.src = url;
  });
}

export default function UploadSchedule({
  childName,
  personId,
}: {
  childName: string | null;
  personId?: string | null;
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [state, setState] = useState<"idle" | "reading" | "done" | "empty" | "error">("idle");
  const [summary, setSummary] = useState<string>("");

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setState("reading");
    try {
      const { data, media_type } = await fileToResizedBase64(file);
      const res = await fetch("/api/ai/schedule", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          image: data,
          media_type,
          team: childName ? `${childName}'s team` : null,
          person_id: personId ?? null,
        }),
      });
      const out = await res.json().catch(() => ({}));
      if (!res.ok || out?.source !== "ai") {
        setState("error");
        return;
      }
      if (out.count === 0) {
        setState("empty");
        return;
      }
      setSummary(
        `Found ${out.count} event${out.count === 1 ? "" : "s"}` +
          (out.events?.length ? ` — ${out.events.slice(0, 3).join(", ")}${out.count > 3 ? "…" : ""}` : "")
      );
      setState("done");
      router.refresh();
    } catch {
      setState("error");
    } finally {
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <div className="mt-6 rounded-2xl border border-line bg-white p-4 shadow-sm">
      <p className="text-sm font-bold">Upload a schedule</p>
      <p className="mt-1 text-[13px] leading-relaxed text-sub">
        Snap a photo of any sports or school schedule and the dates get read
        into your week automatically. Photos are read and deleted, never
        stored.
      </p>
      {state !== "reading" && (
        <>
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleFile}
          />
          <button
            onClick={() => inputRef.current?.click()}
            className="mt-3 rounded-lg bg-brand px-4 py-2 text-[13px] font-semibold text-white"
          >
            {state === "idle" ? "Choose a photo" : "Try another photo"}
          </button>
        </>
      )}
      {state === "reading" && (
        <p className="mt-3 text-[13px] font-semibold text-blue-ink">
          Reading dates from your photo...
        </p>
      )}
      {state === "done" && (
        <p className="mt-3 text-[13px] font-semibold text-brand">
          ✓ {summary}. They&apos;re in your week below.
        </p>
      )}
      {state === "empty" && (
        <p className="mt-3 text-[13px] font-semibold text-sub">
          I couldn&apos;t find any dated events in that photo. A clearer shot of
          the schedule usually does it.
        </p>
      )}
      {state === "error" && (
        <p className="mt-3 text-[13px] font-semibold text-red-600">
          Something went wrong reading that photo. Try again in a moment.
        </p>
      )}
    </div>
  );
}
