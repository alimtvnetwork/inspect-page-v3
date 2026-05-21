/**
 * Helpers for talking to the offscreen document (Stage 6+).
 *
 * Extracted from background.ts per spec R7 (≤100 lines per file).
 */
import { MessageError, makeRequestId } from "@shared/messaging";
import { ErrorCode, MessageKind } from "@shared/enums";

export async function sendOffscreen<P, R>(kind: MessageKind, payload: P): Promise<R> {
  const res = (await chrome.runtime.sendMessage({ kind, requestId: makeRequestId(), payload })) as
    | { ok: true; data: R }
    | { ok: false; error: { code: ErrorCode; message: string; detail?: string } };
  if (!res || res.ok !== true) {
    const err = res?.error ?? { code: ErrorCode.E_STITCH_FAILED, message: "no offscreen reply" };
    throw new MessageError(err.code, err.message, err.detail);
  }
  return res.data;
}

export async function blobToDataUrl(blob: Blob): Promise<string> {
  const buf = await blob.arrayBuffer();
  const bytes = new Uint8Array(buf);
  // Chunked btoa to avoid call-stack overflow on large bundles.
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode.apply(
      null,
      bytes.subarray(i, i + chunk) as unknown as number[],
    );
  }
  const b64 = btoa(binary);
  return `data:${blob.type || "application/zip"};base64,${b64}`;
}
