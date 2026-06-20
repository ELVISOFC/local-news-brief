// Browser SpeechSynthesis wrapper. Real ElevenLabs/OpenAI TTS can be swapped in by
// returning an audio URL and using HTMLAudioElement instead.

export type SpeechHandle = {
  stop: () => void;
};

export function isSpeechSupported() {
  return typeof window !== "undefined" && "speechSynthesis" in window;
}

export function getVoices(): SpeechSynthesisVoice[] {
  if (!isSpeechSupported()) return [];
  return window.speechSynthesis.getVoices();
}

export function speak(
  text: string,
  opts: {
    rate?: number;
    voiceName?: string | null;
    onStart?: () => void;
    onEnd?: () => void;
    onError?: (e: SpeechSynthesisErrorEvent) => void;
    onBoundary?: (e: SpeechSynthesisEvent) => void;
  } = {},
): SpeechHandle {
  if (!isSpeechSupported()) return { stop() {} };
  const synth = window.speechSynthesis;
  synth.cancel();

  const u = new SpeechSynthesisUtterance(text);
  u.rate = opts.rate ?? 1;
  const voices = getVoices();
  const picked =
    voices.find((v) => v.name === opts.voiceName) ??
    voices.find((v) => v.lang.startsWith("en") && /female|samantha|google us/i.test(v.name)) ??
    voices.find((v) => v.lang.startsWith("en")) ??
    voices[0];
  if (picked) u.voice = picked;
  if (opts.onStart) u.onstart = opts.onStart;
  if (opts.onEnd) u.onend = opts.onEnd;
  if (opts.onError) u.onerror = opts.onError;
  if (opts.onBoundary) u.onboundary = opts.onBoundary;
  synth.speak(u);
  return {
    stop() {
      synth.cancel();
    },
  };
}

export function pauseSpeech() {
  if (isSpeechSupported()) window.speechSynthesis.pause();
}
export function resumeSpeech() {
  if (isSpeechSupported()) window.speechSynthesis.resume();
}
export function cancelSpeech() {
  if (isSpeechSupported()) window.speechSynthesis.cancel();
}
