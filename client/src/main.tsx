import * as React from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { captureSignupSource } from "./lib/attribution";
import { initAnalytics } from "./lib/analytics";

captureSignupSource();
initAnalytics();

const container = document.getElementById("root");
if (!container) throw new Error("Failed to find the root element");

createRoot(container).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>
);
