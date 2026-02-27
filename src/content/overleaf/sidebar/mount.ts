import React from "react";
import { createRoot } from "react-dom/client";
import { Sidebar } from "./Sidebar";
// Vite ?inline returns the compiled CSS string — critical for Shadow DOM isolation
import tailwindStyles from "./styles.css?inline";
import { LOGO_DATA_URL } from "@/logo";

let shadowHost: HTMLDivElement | null = null;
let toggleBtn: HTMLButtonElement | null = null;

// Custom event name for toggle button ↔ React component communication
export const TOGGLE_EVENT = "FlowCV-toggle";

export function mountSidebar(): void {
  if (shadowHost) return;

  // ── Toggle button — lives directly on document.body (NOT in shadow DOM) ──
  // This avoids any shadow-DOM overflow/clipping issues with the previous
  // translateX(-100%) approach. Inline styles only — no Tailwind dependency.
  toggleBtn = document.createElement("button");
  toggleBtn.id = "FlowCV-toggle";
  toggleBtn.title = "Toggle FlowCV";
  toggleBtn.setAttribute("aria-label", "Toggle FlowCV sidebar");
  Object.assign(toggleBtn.style, {
    position: "fixed",
    top: "50%",
    right: "0",
    transform: "translateY(-50%)",
    zIndex: "2147483647", // max z-index
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: "4px",
    background: "#398453",
    color: "white",
    border: "none",
    borderRadius: "8px 0 0 8px",
    padding: "12px 6px",
    cursor: "pointer",
    boxShadow: "-2px 0 12px rgba(0,0,0,0.25)",
    fontFamily: "ui-sans-serif, system-ui, sans-serif",
  });
  toggleBtn.innerHTML = `
    <img src="${LOGO_DATA_URL}" width="18" height="18" style="border-radius:3px" alt="" />
    <span style="writing-mode:vertical-rl;font-size:9px;font-weight:700;letter-spacing:0.1em">FlowCV</span>
  `;
  toggleBtn.addEventListener("click", () => {
    document.dispatchEvent(new CustomEvent(TOGGLE_EVENT));
  });
  document.body.appendChild(toggleBtn);

  // ── Shadow DOM host — sidebar panel only, no toggle button ──
  shadowHost = document.createElement("div");
  shadowHost.id = "FlowCV-root";
  Object.assign(shadowHost.style, {
    position: "fixed",
    top: "0",
    right: "0",
    width: "288px",
    height: "100vh",
    zIndex: "999999",
    pointerEvents: "none",
    fontFamily: "ui-sans-serif, system-ui, sans-serif",
  });
  document.body.appendChild(shadowHost);

  const shadow = shadowHost.attachShadow({ mode: "open" });

  const styleEl = document.createElement("style");
  styleEl.textContent = tailwindStyles;
  shadow.appendChild(styleEl);

  const mountPoint = document.createElement("div");
  mountPoint.id = "FlowCV-mount";
  Object.assign(mountPoint.style, {
    pointerEvents: "none",
    height: "100vh",
    display: "flex",
    alignItems: "stretch",
    justifyContent: "flex-end",
  });
  shadow.appendChild(mountPoint);

  createRoot(mountPoint).render(React.createElement(Sidebar));
}

export function unmountSidebar(): void {
  toggleBtn?.remove();
  toggleBtn = null;
  shadowHost?.remove();
  shadowHost = null;
}
