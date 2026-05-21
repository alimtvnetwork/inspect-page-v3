/**
 * chrome.downloads helpers.
 *
 * Extracted from background.ts per spec R7 (≤100 lines per file).
 */
export function waitForDownloadPath(downloadId: number, timeoutMs = 60_000): Promise<string> {
  return new Promise((resolve, reject) => {
    if (downloadId < 0) return reject(new Error("cancelled"));
    const timer = setTimeout(() => {
      chrome.downloads.onChanged.removeListener(handler);
      reject(new Error("timeout"));
    }, timeoutMs);
    const handler = (delta: chrome.downloads.DownloadDelta): void => {
      if (delta.id !== downloadId) return;
      if (delta.state?.current === "complete") {
        clearTimeout(timer);
        chrome.downloads.onChanged.removeListener(handler);
        chrome.downloads.search({ id: downloadId }, (items) => {
          const item = items?.[0];
          if (item?.filename) resolve(item.filename);
          else reject(new Error("no item"));
        });
      } else if (delta.state?.current === "interrupted") {
        clearTimeout(timer);
        chrome.downloads.onChanged.removeListener(handler);
        reject(new Error("interrupted"));
      }
    };
    chrome.downloads.onChanged.addListener(handler);
  });
}
