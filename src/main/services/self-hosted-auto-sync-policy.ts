import type { GameArtifact } from "@types";

export interface SelfHostedSyncAnchor {
  artifactId: string;
  createdAt: string;
}

export type RemoteArtifact = GameArtifact & { kind?: string | null };

/**
 * Returns the newest artifact uploaded by another device after this device's
 * anchor, ignoring safety backups. null means local saves are up to date.
 */
export const findNewerRemoteArtifact = (
  artifacts: RemoteArtifact[],
  anchor: SelfHostedSyncAnchor | null,
  hostname: string
): RemoteArtifact | null => {
  const anchorTime = anchor ? new Date(anchor.createdAt).getTime() : -Infinity;

  const candidates = artifacts.filter(
    (artifact) =>
      artifact.kind !== "safety" &&
      artifact.id !== anchor?.artifactId &&
      artifact.hostname !== hostname &&
      new Date(artifact.createdAt).getTime() > anchorTime
  );

  candidates.sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );

  return candidates[0] ?? null;
};
