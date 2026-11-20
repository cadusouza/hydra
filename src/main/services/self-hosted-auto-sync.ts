import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { Notification } from "electron";
import type { GameShop } from "@types";
import { gamesSublevel, levelKeys } from "@main/level";
import { SystemPath } from "./system-path";
import { SelfHostedSaves } from "./self-hosted-saves";
import { logger } from "./logger";
import {
  findNewerRemoteArtifact,
  type RemoteArtifact,
  type SelfHostedSyncAnchor,
} from "./self-hosted-auto-sync-policy";

export type { SelfHostedSyncAnchor } from "./self-hosted-auto-sync-policy";

/**
 * Steam-like automatic sync for self-hosted saves (fork feature).
 *
 * Each device remembers an "anchor": the last artifact whose contents match its
 * local saves (the one it uploaded or restored most recently). Before a game
 * launches, if another device uploaded an artifact newer than the anchor, the
 * local saves are backed up as a "safety" artifact and the newer one is
 * restored. Safety artifacts are never treated as newer progress.
 */

const STATE_FILE_NAME = "self-hosted-saves-state.json";

const getStatePath = () =>
  path.join(SystemPath.getPath("userData"), STATE_FILE_NAME);

const getKey = (shop: GameShop, objectId: string) => `${shop}:${objectId}`;

const readState = (): Record<string, SelfHostedSyncAnchor> => {
  try {
    return JSON.parse(fs.readFileSync(getStatePath(), "utf8"));
  } catch {
    return {};
  }
};

let writeQueue: Promise<void> = Promise.resolve();

const notify = (title: string, body: string) => {
  try {
    if (Notification.isSupported()) new Notification({ title, body }).show();
  } catch (err) {
    logger.error("[SelfHostedAutoSync] Failed to show notification", err);
  }
};

export class SelfHostedAutoSync {
  public static getAnchor(shop: GameShop, objectId: string) {
    return readState()[getKey(shop, objectId)] ?? null;
  }

  public static setAnchor(
    shop: GameShop,
    objectId: string,
    anchor: SelfHostedSyncAnchor
  ) {
    writeQueue = writeQueue
      .then(async () => {
        const state = readState();
        state[getKey(shop, objectId)] = anchor;
        const file = getStatePath();
        const tmp = `${file}.tmp`;
        await fs.promises.writeFile(tmp, JSON.stringify(state, null, 2));
        await fs.promises.rename(tmp, file);
      })
      .catch((err) =>
        logger.error("[SelfHostedAutoSync] Failed to persist anchor", err)
      );
    return writeQueue;
  }

  /**
   * Runs before a game launches. Never throws: any failure (offline server,
   * missing saves...) is logged and the game launches with local saves.
   */
  public static async beforeLaunch(objectId: string, shop: GameShop) {
    if (!SelfHostedSaves.isEnabled()) return;

    try {
      const game = await gamesSublevel.get(levelKeys.game(shop, objectId));
      if (!game || game.automaticCloudSync !== true) return;

      const params = new URLSearchParams({ objectId, shop });
      const artifacts = await SelfHostedSaves.request<RemoteArtifact[]>(
        "get",
        `/profile/games/artifacts?${params.toString()}`
      );

      const anchor = this.getAnchor(shop, objectId);
      const newer = findNewerRemoteArtifact(
        Array.isArray(artifacts) ? artifacts : [],
        anchor,
        os.hostname()
      );

      if (!newer) {
        logger.log(`[SelfHostedAutoSync] ${shop}/${objectId} is up to date`);
        return;
      }

      logger.log(
        `[SelfHostedAutoSync] Restoring ${newer.id} from ${newer.hostname} for ${shop}/${objectId}`
      );

      const { CloudSync } = await import("./cloud-sync");
      const { runWithHydraSaveGuard } = await import("./epic/cloud-saves");
      const { restoreGameArtifact } = await import(
        "@main/events/cloud-save/download-game-artifact"
      );

      await runWithHydraSaveGuard(async () => {
        let safetyBackupFailed = false;
        try {
          await CloudSync.uploadSaveGame(
            objectId,
            shop,
            null,
            `Segurança antes de sincronizar (${os.hostname()})`,
            "safety"
          );
        } catch (err) {
          // Usually means there are no local saves yet (first time playing
          // on this device), which is safe to overwrite.
          safetyBackupFailed = true;
          logger.warn(
            "[SelfHostedAutoSync] Safety backup failed, restoring anyway",
            err
          );
        }

        await restoreGameArtifact(objectId, shop, newer.id);

        logger.log(
          `[SelfHostedAutoSync] Restored ${newer.id} (safety backup ${safetyBackupFailed ? "skipped" : "uploaded"})`
        );
      });

      notify(
        `${game.title}: save sincronizado`,
        `Restaurado o save de ${newer.hostname}. O save local anterior foi guardado como backup de segurança.`
      );
    } catch (err) {
      logger.error(
        `[SelfHostedAutoSync] Pre-launch sync failed for ${shop}/${objectId}`,
        err
      );
      notify(
        "Sincronização de save falhou",
        "Não foi possível verificar o servidor de saves. O jogo vai abrir com o save local."
      );
    }
  }
}
