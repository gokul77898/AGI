import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { WorkspaceSetupStepId } from "@octogent/core";

const SETUP_STATE_RELATIVE_PATH = join("state", "setup.json");
const VERIFIED_SETUP_STEP_IDS = ["check-claude", "check-git", "check-curl"] as const;

type VerifiedSetupStepId = (typeof VERIFIED_SETUP_STEP_IDS)[number];

export type SetupState = {
  version: 1;
  tentaclesInitializedAt?: string;
  verifiedSteps?: Partial<Record<VerifiedSetupStepId, string>>;
};

const isVerifiedSetupStepId = (value: WorkspaceSetupStepId): value is VerifiedSetupStepId =>
  VERIFIED_SETUP_STEP_IDS.includes(value as VerifiedSetupStepId);

export const readSetupState = (stateDir: string): SetupState => {
  const filePath = join(stateDir, SETUP_STATE_RELATIVE_PATH);
  if (!existsSync(filePath)) {
    return { version: 1 };
  }

  try {
    const raw = JSON.parse(readFileSync(filePath, "utf-8")) as Partial<SetupState>;
    const verifiedSteps: Partial<Record<VerifiedSetupStepId, string>> = {};
    const rawVerifiedSteps = raw.verifiedSteps;
    if (rawVerifiedSteps && typeof rawVerifiedSteps === "object") {
      for (const stepId of VERIFIED_SETUP_STEP_IDS) {
        const checkedAt = rawVerifiedSteps[stepId];
        if (typeof checkedAt === "string") {
          verifiedSteps[stepId] = checkedAt;
        }
      }
    }

    return {
      version: 1,
      ...(typeof raw.tentaclesInitializedAt === "string"
        ? { tentaclesInitializedAt: raw.tentaclesInitializedAt }
        : {}),
      ...(Object.keys(verifiedSteps).length > 0 ? { verifiedSteps } : {}),
    };
  } catch {
    return { version: 1 };
  }
};

export const writeSetupState = (stateDir: string, state: SetupState) => {
  mkdirSync(join(stateDir, "state"), { recursive: true });
  writeFileSync(join(stateDir, SETUP_STATE_RELATIVE_PATH), `${JSON.stringify(state, null, 2)}\n`);
};

export const markSetupStepVerified = (stateDir: string, stepId: WorkspaceSetupStepId) => {
  if (!isVerifiedSetupStepId(stepId)) {
    return;
  }

  const currentState = readSetupState(stateDir);
  writeSetupState(stateDir, {
    ...currentState,
    verifiedSteps: {
      ...currentState.verifiedSteps,
      [stepId]: new Date().toISOString(),
    },
  });
};

export const markTentaclesInitialized = (stateDir: string) => {
  const currentState = readSetupState(stateDir);
  if (currentState.tentaclesInitializedAt) {
    return;
  }

  writeSetupState(stateDir, {
    ...currentState,
    tentaclesInitializedAt: new Date().toISOString(),
  });
};
