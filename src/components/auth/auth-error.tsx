import { AlertCircle } from "lucide-react";

export function AuthError({ message }: { message: string }) {
  return (
    <div
      className="flex gap-2.5 rounded-xl border border-destructive/25 bg-destructive/5 px-3.5 py-3 text-sm text-destructive"
      role="alert"
    >
      <AlertCircle className="mt-0.5 size-4 shrink-0" />
      <p>{message}</p>
    </div>
  );
}
