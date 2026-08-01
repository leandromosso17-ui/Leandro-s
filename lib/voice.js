"use client";

// Speak text using ElevenLabs (via /api/voice). Falls back to the browser's
// built-in speech synthesis if the API key isn't configured or the call fails,
// so the demo always produces a voice.
export async function speak(text) {
  try {
    const res = await fetch("/api/voice", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    });
    const type = res.headers.get("content-type") || "";
    if (res.ok && type.includes("audio")) {
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      audio.addEventListener("ended", () => URL.revokeObjectURL(url));
      await audio.play();
      return { source: "elevenlabs", audio };
    }
  } catch {
    /* fall through to browser voice */
  }

  if (typeof window !== "undefined" && "speechSynthesis" in window) {
    const u = new SpeechSynthesisUtterance(text);
    u.rate = 0.95;
    u.pitch = 1;
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(u);
    return { source: "browser" };
  }
  return { source: "none" };
}
