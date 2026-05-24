/**
 * Shadow-DOM CSS for the element picker overlay. Split out of picker.ts
 * per R7 (file-size). Two strings: STYLE (highlight box + tooltip) and
 * SEL_STYLE (multi-select rings + Done bar + toast).
 */
import { Z_INDEX_PICKER } from "@shared/constants";

export const PICKER_STYLE = `
:host { all: initial; }
.lpe-pk-box {
  position: fixed; pointer-events: none;
  outline: 2px solid #7c5cff;
  background: rgba(124,92,255,0.12);
  z-index: ${Z_INDEX_PICKER};
  transition: none;
  display: none;
}
.lpe-pk-margin, .lpe-pk-padding {
  position: fixed; pointer-events: none;
  z-index: ${Z_INDEX_PICKER};
  display: none;
  box-sizing: border-box;
}
.lpe-pk-margin { outline: 1px dashed rgba(255,165,0,0.55); background: rgba(255,165,0,0.07); }
.lpe-pk-padding { outline: 1px dashed rgba(60,200,140,0.6); background: rgba(60,200,140,0.07); }
.lpe-pk-badge {
  position: fixed; pointer-events: none;
  z-index: ${Z_INDEX_PICKER};
  display: none;
  background: #1c1c1c; color: #f0f0f0;
  font: 10px ui-monospace, SFMono-Regular, Menlo, monospace;
  padding: 1px 4px; border-radius: 3px;
  box-shadow: 0 1px 2px rgba(0,0,0,0.35);
  white-space: nowrap;
}
.lpe-pk-size {
  background: #7c5cff; color: #ffffff;
  font: 10px ui-monospace, SFMono-Regular, Menlo, monospace;
  padding: 2px 6px; border-radius: 3px;
  white-space: nowrap;
}
/* P1: chip group with size + action icons (clickable) */
.lpe-pk-chip {
  position: fixed; z-index: ${Z_INDEX_PICKER};
  display: none; align-items: center; gap: 4px;
  padding: 3px; border-radius: 5px;
  background: rgba(13,17,23,0.92); color: #f6f8fa;
  box-shadow: 0 4px 12px rgba(0,0,0,0.35);
  border: 1px solid rgba(255,255,255,0.08);
  pointer-events: auto;
  font: 11px ui-sans-serif, system-ui, sans-serif;
}
.lpe-pk-chip-btn {
  all: unset; box-sizing: border-box;
  display: inline-flex; align-items: center; justify-content: center;
  width: 22px; height: 22px; border-radius: 4px;
  cursor: pointer; color: #f6f8fa;
  font: 12px ui-sans-serif, system-ui, sans-serif;
}
.lpe-pk-chip-btn:hover { background: rgba(255,255,255,0.12); }
.lpe-pk-chip-btn:focus-visible { outline: 2px solid #7c5cff; outline-offset: 1px; }
.lpe-pk-chip-btn[data-variant="select"]:hover { background: rgba(60,200,140,0.25); color: #6dffb0; }
.lpe-pk-chip-btn[data-variant="cancel"]:hover { background: rgba(255,90,90,0.25); color: #ffb4b4; }
.lpe-pk-chip-flash {
  display: none; padding: 0 6px; border-radius: 3px;
  background: rgba(60,200,140,0.25); color: #6dffb0;
  font-size: 10px;
}
.lpe-pk-guide {
  position: fixed; pointer-events: none;
  z-index: ${Z_INDEX_PICKER};
  display: none;
  background: rgba(124,92,255,0.55);
}
.lpe-pk-guide.h { height: 1px; }
.lpe-pk-guide.v { width: 1px; }
.lpe-pk-glabel {
  position: fixed; pointer-events: none;
  z-index: ${Z_INDEX_PICKER};
  display: none;
  background: #7c5cff; color: #ffffff;
  font: 10px ui-monospace, SFMono-Regular, Menlo, monospace;
  padding: 1px 4px; border-radius: 3px;
  white-space: nowrap;
}
.lpe-pk-tip {
  position: fixed; pointer-events: none;
  background: #0d1117; color: #f6f8fa;
  font: 12px ui-sans-serif, system-ui, sans-serif;
  padding: 10px 12px; border-radius: 10px;
  box-shadow: 0 6px 18px rgba(0,0,0,0.32);
  border: 1px solid rgba(255,255,255,0.08);
  z-index: ${Z_INDEX_PICKER};
  max-width: 360px; min-width: 240px;
  display: none;
}
.lpe-pk-tip b { color: #c4b5fd; font-weight: 600; }
.lpe-pk-tip i { color: #9ca3af; font-style: normal; margin-left: 6px; }
.lpe-pk-tip .lpe-pk-head { font: 600 13px ui-sans-serif, system-ui, sans-serif; color: #f6f8fa; margin-bottom: 2px; word-break: break-all; }
.lpe-pk-tip .lpe-pk-sub { font: 11px ui-monospace, SFMono-Regular, Menlo, monospace; color: #9ca3af; margin-bottom: 8px; }
.lpe-pk-tip .lpe-pk-rows { display: grid; grid-template-columns: 88px 1fr; row-gap: 4px; column-gap: 8px; align-items: center; }
.lpe-pk-tip .lpe-pk-k { color: #9ca3af; font-size: 11px; }
.lpe-pk-tip .lpe-pk-v { color: #f6f8fa; font: 11px ui-monospace, SFMono-Regular, Menlo, monospace; display: inline-flex; align-items: center; gap: 6px; word-break: break-all; }
.lpe-pk-tip .lpe-pk-sw { width: 12px; height: 12px; border-radius: 3px; border: 1px solid rgba(255,255,255,0.18); flex: none; background-image: linear-gradient(45deg, #555 25%, transparent 25%), linear-gradient(-45deg, #555 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #555 75%), linear-gradient(-45deg, transparent 75%, #555 75%); background-size: 6px 6px; background-position: 0 0, 0 3px, 3px -3px, -3px 0; }
.lpe-pk-tip .lpe-pk-sw-fill { background-image: none; }
.lpe-pk-tip .lpe-pk-pill { display: inline-flex; align-items: center; gap: 4px; padding: 1px 8px; border-radius: 999px; font-size: 11px; font-weight: 600; }
.lpe-pk-tip .lpe-pk-pill.ok { background: rgba(60,200,140,0.18); color: #6dffb0; }
.lpe-pk-tip .lpe-pk-pill.warn { background: rgba(255,196,84,0.18); color: #ffd479; }
.lpe-pk-tip .lpe-pk-pill.bad { background: rgba(255,90,90,0.2); color: #ffb4b4; }
`;

export const PICKER_SEL_STYLE = `
:host([data-chrome-hidden="true"]) .lpe-pk-chip,
:host([data-chrome-hidden="true"]) .lpe-pk-bar,
:host([data-chrome-hidden="true"]) .lpe-pk-toast {
  display: none !important;
}
.lpe-pk-sel-ring {
  position: fixed; pointer-events: none;
  outline: 2px solid #2DD4A8;
  background: rgba(45,212,168,0.10);
  z-index: ${Z_INDEX_PICKER};
  box-sizing: border-box;
}
.lpe-pk-sel-num {
  position: fixed; pointer-events: none;
  background: linear-gradient(135deg,#2DD4A8,#73FFB8);
  color: #0B0F0E;
  font: 700 11px ui-monospace, SFMono-Regular, Menlo, monospace;
  min-width: 18px; height: 18px; line-height: 18px;
  padding: 0 5px; border-radius: 9px; text-align: center;
  box-shadow: 0 2px 6px rgba(0,0,0,0.35);
  z-index: ${Z_INDEX_PICKER};
}
.lpe-pk-bar {
  position: fixed; top: 12px; left: 50%; transform: translateX(-50%);
  z-index: ${Z_INDEX_PICKER};
  display: inline-flex; align-items: center; gap: 8px;
  padding: 6px 8px; border-radius: 10px;
  background: rgba(13,17,23,0.94); color: #F5FFFA;
  border: 1px solid rgba(45,212,168,0.35);
  box-shadow: 0 8px 24px rgba(0,0,0,0.45);
  font: 12px ui-sans-serif, system-ui, sans-serif;
  pointer-events: auto;
}
.lpe-pk-bar-count { color: #9ca3af; font: 11px ui-monospace, SFMono-Regular, Menlo, monospace; padding: 0 4px; }
.lpe-pk-bar-btn {
  all: unset; box-sizing: border-box; cursor: pointer;
  padding: 4px 10px; border-radius: 6px;
  font: 600 12px ui-sans-serif, system-ui, sans-serif;
}
.lpe-pk-bar-btn[data-variant="done"] {
  background: linear-gradient(135deg,#2DD4A8,#73FFB8); color: #0B0F0E;
}
.lpe-pk-bar-btn[data-variant="done"]:disabled { opacity: 0.4; cursor: not-allowed; }
.lpe-pk-bar-btn[data-variant="cancel"] { color: #ffb4b4; }
.lpe-pk-bar-btn[data-variant="cancel"]:hover { background: rgba(255,90,90,0.18); }
.lpe-pk-toast {
  position: fixed; top: 56px; left: 50%; transform: translateX(-50%);
  z-index: ${Z_INDEX_PICKER};
  padding: 6px 12px; border-radius: 8px;
  background: rgba(255,90,90,0.92); color: #fff;
  font: 600 12px ui-sans-serif, system-ui, sans-serif;
  box-shadow: 0 6px 18px rgba(0,0,0,0.45);
  display: none;
}
`;
