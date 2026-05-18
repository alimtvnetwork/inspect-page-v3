/**
 * Popup entry. Mounts <ExportPanel surface="popup"/> into #root.
 * Source: spec/21-app/02-ui-panel.md.
 */
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { LogCategory } from "@shared/enums";
import { logger } from "@shared/logger";
import { ExportPanel } from "@panel/ExportPanel";
import "@panel/styles.css";

logger.debug(LogCategory.Lifecycle, "Popup loaded");

async function getActiveTab(): Promise<{ url?: string; id?: number }> {
  try {
    const tabId = new URLSearchParams(window.location.search).get("tabId");
    if (tabId && /^\d+$/.test(tabId)) {
      const tab = await chrome.tabs.get(Number(tabId));
      return { url: tab?.url, id: tab?.id };
    }
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    return { url: tab?.url, id: tab?.id };
  } catch (e) {
    logger.error(LogCategory.Lifecycle, "POPUP_TABS_QUERY", "tabs.query failed", e);
    return {};
  }
}

async function bootstrap(): Promise<void> {
  const root = document.getElementById("root");
  if (!root) return;
  const { url, id } = await getActiveTab();
  createRoot(root).render(
    <StrictMode>
      <ExportPanel surface="popup" activeUrl={url} activeTabId={id} />
    </StrictMode>,
  );
}

void bootstrap();
