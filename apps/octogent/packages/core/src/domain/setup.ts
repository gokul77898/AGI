export type WorkspaceSetupStepId =
  | "initialize-workspace"
  | "ensure-gitignore"
  | "check-claude"
  | "check-git"
  | "check-curl"
  | "create-tentacles";

export type WorkspaceSetupStep = {
  id: WorkspaceSetupStepId;
  title: string;
  description: string;
  complete: boolean;
  required: boolean;
  actionLabel: string | null;
  statusText: string;
  guidance: string | null;
  command: string | null;
};

export type WorkspaceSetupSnapshot = {
  isFirstRun: boolean;
  shouldShowSetupCard: boolean;
  hasAnyTentacles: boolean;
  tentacleCount: number;
  steps: WorkspaceSetupStep[];
};
