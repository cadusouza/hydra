import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  findNewerRemoteArtifact,
  type RemoteArtifact,
} from "./self-hosted-auto-sync-policy.js";

const artifact = (
  id: string,
  hostname: string,
  createdAt: string,
  kind: string | null = null
): RemoteArtifact => ({
  id,
  hostname,
  createdAt,
  updatedAt: createdAt,
  artifactLengthInBytes: 1,
  downloadOptionTitle: null,
  downloadCount: 0,
  isFrozen: false,
  kind,
});

describe("findNewerRemoteArtifact", () => {
  it("returns nothing when there are no artifacts", () => {
    assert.equal(findNewerRemoteArtifact([], null, "pc"), null);
  });

  it("restores the newest artifact from another device on first sync", () => {
    const result = findNewerRemoteArtifact(
      [
        artifact("a", "notebook", "2026-11-20T10:00:00Z"),
        artifact("b", "notebook", "2026-11-20T12:00:00Z"),
      ],
      null,
      "pc"
    );
    assert.equal(result?.id, "b");
  });

  it("ignores this device's own uploads", () => {
    const result = findNewerRemoteArtifact(
      [artifact("a", "pc", "2026-11-20T12:00:00Z")],
      null,
      "pc"
    );
    assert.equal(result, null);
  });

  it("ignores artifacts older than or equal to the anchor", () => {
    const result = findNewerRemoteArtifact(
      [
        artifact("old", "notebook", "2026-11-20T10:00:00Z"),
        artifact("anchor", "notebook", "2026-11-20T11:00:00Z"),
      ],
      { artifactId: "anchor", createdAt: "2026-11-20T11:00:00Z" },
      "pc"
    );
    assert.equal(result, null);
  });

  it("ignores safety backups taken by other devices before restoring", () => {
    // pc uploaded at 11h; notebook restored it, taking a safety backup at 12h.
    const result = findNewerRemoteArtifact(
      [
        artifact("pc-close", "pc", "2026-11-20T11:00:00Z"),
        artifact("nb-safety", "notebook", "2026-11-20T12:00:00Z", "safety"),
      ],
      { artifactId: "pc-close", createdAt: "2026-11-20T11:00:00Z" },
      "pc"
    );
    assert.equal(result, null);
  });

  it("picks up progress uploaded by another device after the anchor", () => {
    const result = findNewerRemoteArtifact(
      [
        artifact("pc-close", "pc", "2026-11-20T11:00:00Z"),
        artifact("nb-safety", "notebook", "2026-11-20T12:00:00Z", "safety"),
        artifact("nb-close", "notebook", "2026-11-20T14:00:00Z"),
      ],
      { artifactId: "pc-close", createdAt: "2026-11-20T11:00:00Z" },
      "pc"
    );
    assert.equal(result?.id, "nb-close");
  });
});
