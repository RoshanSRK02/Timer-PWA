import { useState } from "react";
import { Bell, Volume2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  alarmSounds,
  useTimerPreferencesStore,
} from "@/stores/use-timer-preferences-store";
import { playAlarmSound } from "@/services/alarm-sounds";

export function TimerSettings() {
  const alarmSound = useTimerPreferencesStore((state) => state.alarmSound);
  const volume = useTimerPreferencesStore((state) => state.volume);
  const setAlarmSound = useTimerPreferencesStore((state) => state.setAlarmSound);
  const setVolume = useTimerPreferencesStore((state) => state.setVolume);
  const [previewError, setPreviewError] = useState<string | null>(null);

  async function preview() {
    setPreviewError(null);
    try {
      await playAlarmSound(alarmSound, volume);
    } catch (error) {
      setPreviewError(
        error instanceof Error ? error.message : "Unable to play the alarm.",
      );
    }
  }

  return (
    <div className="flex flex-wrap items-end gap-3">
      <div className="min-w-[155px] flex-1 space-y-1.5">
        <label
          htmlFor="alarm-sound"
          className="flex items-center gap-1.5 text-[11px] font-semibold text-muted-foreground"
        >
          <Bell className="size-3.5" /> Alarm sound
        </label>
        <select
          id="alarm-sound"
          value={alarmSound}
          onChange={(event) => {
            const selection = alarmSounds.find(
              (sound) => sound.value === event.target.value,
            );
            if (selection) setAlarmSound(selection.value);
          }}
          className="h-9 w-full rounded-lg border border-input bg-background px-2.5 text-xs font-medium text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {alarmSounds.map((sound) => (
            <option key={sound.value} value={sound.value}>
              {sound.label}
            </option>
          ))}
        </select>
      </div>
      <div className="w-[110px] space-y-1.5">
        <label
          htmlFor="alarm-volume"
          className="flex items-center justify-between gap-1.5 text-[11px] font-semibold text-muted-foreground"
        >
          <span className="flex items-center gap-1.5">
            <Volume2 className="size-3.5" /> Volume
          </span>
          <span>{volume}%</span>
        </label>
        <input
          id="alarm-volume"
          type="range"
          min={0}
          max={100}
          step={1}
          value={volume}
          onChange={(event) => setVolume(Number(event.target.value))}
          className="h-9 w-full accent-primary"
        />
      </div>
      <Button
        type="button"
        size="sm"
        variant="outline"
        className="h-9"
        onClick={() => void preview()}
      >
        Test
      </Button>
      {previewError && (
        <p className="basis-full text-xs text-destructive" role="alert">
          {previewError}
        </p>
      )}
    </div>
  );
}
