import React from "react";
import ReactDOM from "react-dom/client";
import { App } from "@/app/app";
import "@/index.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);

if (import.meta.env.PROD && "serviceWorker" in navigator) {
  void navigator.serviceWorker
    .register(`${import.meta.env.BASE_URL}sw.js`, {
      scope: import.meta.env.BASE_URL,
    })
    .catch((error: unknown) => {
      console.error("Tempo offline app shell could not be registered.", error);
    });
}
