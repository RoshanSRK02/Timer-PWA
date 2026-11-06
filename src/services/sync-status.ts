const LAST_SYNC_KEY = "tempo-last-sync";
const SYNC_UPDATED_EVENT = "tempo:sync-updated";

export function getLastSyncTime(): string | null {
  return localStorage.getItem(LAST_SYNC_KEY);
}

export function markSyncComplete(): void {
  localStorage.setItem(LAST_SYNC_KEY, new Date().toISOString());
  window.dispatchEvent(new Event(SYNC_UPDATED_EVENT));
}

export function onSyncStatusChange(listener: () => void): () => void {
  window.addEventListener(SYNC_UPDATED_EVENT, listener);
  window.addEventListener("storage", listener);
  return () => {
    window.removeEventListener(SYNC_UPDATED_EVENT, listener);
    window.removeEventListener("storage", listener);
  };
}
