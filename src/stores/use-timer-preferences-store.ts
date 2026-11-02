import { create } from "zustand";
import { persist } from "zustand/middleware";

export type AlarmSound =
  | "classic-bell"
  | "digital-alarm"
  | "soft-chime"
  | "school-bell"
  | "gentle-piano"
  | "nature-bell";

interface TimerPreferencesState {
  alarmSound: AlarmSound;
  volume: number;
  autoPlay: boolean;
  setAlarmSound: (alarmSound: AlarmSound) => void;
  setVolume: (volume: number) => void;
  setAutoPlay: (autoPlay: boolean) => void;
}

export const alarmSounds: { value: AlarmSound; label: string }[] = [
  { value: "classic-bell", label: "Classic Bell" },
  { value: "digital-alarm", label: "Digital Alarm" },
  { value: "soft-chime", label: "Soft Chime" },
  { value: "school-bell", label: "School Bell" },
  { value: "gentle-piano", label: "Gentle Piano" },
  { value: "nature-bell", label: "Nature Bell" },
];

export const useTimerPreferencesStore = create<TimerPreferencesState>()(
  persist(
    (set) => ({
      alarmSound: "soft-chime",
      volume: 65,
      autoPlay: true,
      setAlarmSound: (alarmSound) => set({ alarmSound }),
      setVolume: (volume) =>
        set({ volume: Math.max(0, Math.min(100, Math.round(volume))) }),
      setAutoPlay: (autoPlay) => set({ autoPlay }),
    }),
    { name: "tempo-timer-preferences" },
  ),
);
