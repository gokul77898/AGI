const isEnabled = (value: string | undefined): boolean => value === "1";

export const isVerboseLoggingEnabled = (): boolean => isEnabled(process.env.OCTOGENT_VERBOSE_LOGS);

export const logVerbose = (...args: Parameters<typeof console.log>): void => {
  if (isVerboseLoggingEnabled()) {
    console.log(...args);
  }
};
