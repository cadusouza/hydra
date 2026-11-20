import { registerEvent } from "../register-event";
import { SelfHostedSaves } from "@main/services/self-hosted-saves";

const getSelfHostedSavesStatus = async () => ({
  enabled: SelfHostedSaves.isEnabled(),
  configFilePath: SelfHostedSaves.getConfigFilePath(),
});

registerEvent("getSelfHostedSavesStatus", getSelfHostedSavesStatus);
