import type { AlarmSound } from "@/stores/use-timer-preferences-store";

const patterns: Record<AlarmSound, { frequencies: number[]; spacing: number; wave: OscillatorType; duration: number }> = {
  "classic-bell": { frequencies: [880, 660, 880], spacing: 0.22, wave: "sine", duration: 0.7 },
  "digital-alarm": { frequencies: [880, 880, 880, 1046], spacing: 0.14, wave: "square", duration: 0.12 },
  "soft-chime": { frequencies: [784, 988, 1174], spacing: 0.25, wave: "sine", duration: 0.85 },
  "school-bell": { frequencies: [659, 659, 659, 659], spacing: 0.18, wave: "triangle", duration: 0.4 },
  "gentle-piano": { frequencies: [523, 659, 784], spacing: 0.28, wave: "triangle", duration: 0.9 },
  "nature-bell": { frequencies: [587, 880, 740, 988], spacing: 0.3, wave: "sine", duration: 0.8 },
};

export async function playAlarmSound(
  sound: AlarmSound,
  volume: number,
): Promise<void> {
  if (volume <= 0) return;
  const AudioContextConstructor =
    window.AudioContext ??
    (window as typeof window & { webkitAudioContext?: typeof AudioContext })
      .webkitAudioContext;

  if (!AudioContextConstructor) {
    throw new Error("Audio playback is not supported by this browser.");
  }

  const context = new AudioContextConstructor();
  try {
    await context.resume();
    const pattern = patterns[sound];
    const gain = context.createGain();
    gain.gain.value = Math.max(0, Math.min(1, volume / 100));
    gain.connect(context.destination);
    const start = context.currentTime + 0.03;

    pattern.frequencies.forEach((frequency, index) => {
      const oscillator = context.createOscillator();
      const envelope = context.createGain();
      const noteStart = start + index * pattern.spacing;
      oscillator.type = pattern.wave;
      oscillator.frequency.value = frequency;
      envelope.gain.setValueAtTime(0.0001, noteStart);
      envelope.gain.exponentialRampToValueAtTime(0.65, noteStart + 0.025);
      envelope.gain.exponentialRampToValueAtTime(
        0.0001,
        noteStart + pattern.duration,
      );
      oscillator.connect(envelope);
      envelope.connect(gain);
      oscillator.start(noteStart);
      oscillator.stop(noteStart + pattern.duration + 0.03);
    });

    const endTime =
      start +
      (pattern.frequencies.length - 1) * pattern.spacing +
      pattern.duration +
      0.1;
    await new Promise<void>((resolve) => {
      window.setTimeout(resolve, Math.max(0, (endTime - start) * 1000));
    });
  } finally {
    await context.close();
  }
}
