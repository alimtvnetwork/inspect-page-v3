/**
 * Offscreen document — owns OffscreenCanvas instances per export session.
 * Source: spec/21-app/06-screenshot-strategy.md §C.
 *
 * Sessions are keyed by sessionId so concurrent exports cannot collide.
 * Init → AddFrame* → StitchFinish → Dispose.
 */
import { ErrorCode, LogCategory, MessageKind } from "@shared/enums";
import { logger } from "@shared/logger";
import { MessageError, MessageRouter } from "@shared/messaging";
import type {
  OffscreenAddFramePayload,
  OffscreenAddFrameResponse,
  OffscreenDisposePayload,
  OffscreenDisposeResponse,
  OffscreenInitPayload,
  OffscreenInitResponse,
  OffscreenStitchFinishPayload,
  OffscreenStitchFinishResponse,
} from "@shared/types";

logger.debug(LogCategory.Offscreen, "Offscreen document loaded");

interface Session {
  canvas: OffscreenCanvas;
  ctx: OffscreenCanvasRenderingContext2D;
  framesPlaced: number;
}

const sessions = new Map<string, Session>();

const router = new MessageRouter();

router.on<OffscreenInitPayload, OffscreenInitResponse>(MessageKind.OffscreenInit, ({ widthPx, heightPx, sessionId }) => {
  const canvas = new OffscreenCanvas(widthPx, heightPx);
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new MessageError(ErrorCode.E_STITCH_FAILED, "OffscreenCanvas 2d context unavailable");
  }
  sessions.set(sessionId, { canvas, ctx, framesPlaced: 0 });
  logger.info(LogCategory.Offscreen, `init session ${sessionId} ${widthPx}x${heightPx}`);
  return { ok: true };
});

router.on<OffscreenAddFramePayload & { sessionId: string }, OffscreenAddFrameResponse>(
  MessageKind.OffscreenAddFrame,
  async ({ dataUrl, xPx, yPx, sessionId }) => {
    const s = sessions.get(sessionId);
    if (!s) throw new MessageError(ErrorCode.E_OFFSCREEN_BUSY, "no session");
    const blob = await (await fetch(dataUrl)).blob();
    const bmp = await createImageBitmap(blob);
    s.ctx.drawImage(bmp, xPx, yPx);
    bmp.close?.();
    s.framesPlaced++;
    return { framesPlaced: s.framesPlaced };
  },
);

router.on<OffscreenStitchFinishPayload & { sessionId: string }, OffscreenStitchFinishResponse>(
  MessageKind.OffscreenStitchFinish,
  async ({ format, quality, sessionId }) => {
    const s = sessions.get(sessionId);
    if (!s) throw new MessageError(ErrorCode.E_OFFSCREEN_BUSY, "no session");
    try {
      const blob = await s.canvas.convertToBlob({
        type: `image/${format}`,
        quality: format === "jpeg" ? Math.max(0, Math.min(1, (quality ?? 90) / 100)) : undefined,
      });
      const blobUrl = URL.createObjectURL(blob);
      return {
        blobUrl,
        widthPx: s.canvas.width,
        heightPx: s.canvas.height,
        bytes: blob.size,
      };
    } catch (e) {
      logger.error(LogCategory.Offscreen, ErrorCode.E_STITCH_FAILED, "convertToBlob failed", e);
      throw new MessageError(ErrorCode.E_STITCH_FAILED, "Failed to encode stitched image");
    }
  },
);

router.on<OffscreenDisposePayload, OffscreenDisposeResponse>(
  MessageKind.OffscreenDispose,
  ({ sessionId }) => {
    sessions.delete(sessionId);
  },
);

router.attach();
