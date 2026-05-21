/**
 * ElementInspectorWithCode — inspector + code drawer + export modes for picked elements.
 * Extracted from ExportPanel.tsx (B1 r10).
 */
import { useState } from "react";
import type { StatusUpdatePayload, ExportArtifacts } from "@shared/types";
import type { ElementSnapshot } from "@element/collectElementSnapshot";
import { ElementInspector } from "./element/ElementInspector";
import { CodeDrawer } from "./element/CodeDrawer";
import { ExportModes } from "./ExportModes";
import { buildElementArtifacts, buildCombinedElementArtifacts } from "./artifacts";

export interface ElementInspectorWithCodeProps {
  snapshot: ElementSnapshot;
  onBack: () => void;
  preview?: StatusUpdatePayload["debugPreview"];
  activeUrl?: string;
  shareEnabled?: boolean;
  onShare?: (artifacts: ExportArtifacts) => Promise<void>;
  onTogglePickerLock?: (next: boolean) => void;
  pickerLocked?: boolean;
  multiPicks?: NonNullable<StatusUpdatePayload["multiElementSnapshot"]>;
}

export function ElementInspectorWithCode({
  snapshot, onBack, preview, activeUrl, shareEnabled, onShare, onTogglePickerLock, pickerLocked, multiPicks,
}: ElementInspectorWithCodeProps): JSX.Element {
  const [showCode, setShowCode] = useState(false);
  const artifacts = multiPicks && multiPicks.length > 1
    ? buildCombinedElementArtifacts(multiPicks, activeUrl)
    : preview ? buildElementArtifacts(preview, activeUrl) : null;
  return (
    <>
      <ElementInspector
        snapshot={snapshot}
        onBack={onBack}
        onShowCode={() => setShowCode(true)}
        onTogglePickerLock={onTogglePickerLock}
        pickerLocked={pickerLocked}
      />
      {showCode && <CodeDrawer snapshot={snapshot} onClose={() => setShowCode(false)} />}
      {artifacts && (
        <div className="lpe-eli-export">
          <ExportModes
            artifacts={artifacts}
            shareEnabled={shareEnabled}
            onShare={onShare}
          />
        </div>
      )}
    </>
  );
}