const LOVABLE_TOKEN_PARAM = "__lovable_token";

const isLovablePreviewHost = (): boolean => {
  const host = window.location.hostname;
  return host.includes("lovableproject.com") || host.includes("id-preview--");
};

const buildDownloadUrl = (fileUrl: string): string => {
  const url = new URL(fileUrl, window.location.href);
  const previewToken = new URLSearchParams(window.location.search).get(LOVABLE_TOKEN_PARAM);

  if (previewToken && !url.searchParams.has(LOVABLE_TOKEN_PARAM)) {
    url.searchParams.set(LOVABLE_TOKEN_PARAM, previewToken);
  }

  return url.toString();
};

const triggerDirectDownload = (fileUrl: string, filename: string): void => {
  const a = document.createElement("a");
  a.href = buildDownloadUrl(fileUrl);
  a.download = filename;
  a.target = "_blank";
  a.rel = "noopener noreferrer";
  document.body.appendChild(a);
  a.click();
  a.remove();
};

export const downloadStaticFile = async (fileUrl: string, filename: string): Promise<"direct" | "blob"> => {
  if (isLovablePreviewHost()) {
    triggerDirectDownload(fileUrl, filename);
    return "direct";
  }

  try {
    const res = await fetch(fileUrl);
    if (!res.ok) throw new Error(`Download failed: ${res.status}`);

    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1_000);
    return "blob";
  } catch (error) {
    triggerDirectDownload(fileUrl, filename);
    return "direct";
  }
};