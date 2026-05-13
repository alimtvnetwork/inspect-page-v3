/**
 * First-launch onboarding banner state for the extension popup.
 * Dismissed once via user click, remembered in chrome.storage.local.
 */
const STORAGE_ONBOARDING_KEY = "inspect-page.onboarding";

interface OnboardingState {
  dismissed: boolean;
}

function isOnboardingState(v: unknown): v is OnboardingState {
  if (typeof v !== "object" || v === null) return false;
  const o = v as Record<string, unknown>;
  return typeof o.dismissed === "boolean";
}

export async function getOnboardingState(): Promise<OnboardingState> {
  const items = await chrome.storage.local.get(STORAGE_ONBOARDING_KEY);
  const raw = items[STORAGE_ONBOARDING_KEY];
  return isOnboardingState(raw) ? raw : { dismissed: false };
}

export async function dismissOnboarding(): Promise<void> {
  await chrome.storage.local.set({ [STORAGE_ONBOARDING_KEY]: { dismissed: true } });
}
