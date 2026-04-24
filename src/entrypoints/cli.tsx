import { feature } from 'bun:bundle';
import { readFileSync } from 'fs';
import { resolve } from 'path';

// Auto-load .env from project root BEFORE anything else
// eslint-disable-next-line custom-rules/no-top-level-side-effects
try {
  const envPath = resolve(process.cwd(), '.env');
  const envContent = readFileSync(envPath, 'utf-8');
  for (const line of envContent.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx === -1) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    const val = trimmed.slice(eqIdx + 1).trim();
    if (key && !(key in process.env)) {
      process.env[key] = val;
    }
  }
} catch { /* no .env file — that's fine */ }

declare const MACRO: { VERSION: string; DISPLAY_VERSION?: string };
import {
  applyProfileEnvToProcessEnv,
  buildStartupEnvFromProfile,
} from '../utils/providerProfile.js'
import {
  getProviderValidationError,
  validateProviderEnvOrExit,
} from '../utils/providerValidation.js'

// CORTEX: disable experimental API betas by default.
// Tool search (defer_loading), global cache scope, and context management
// require internal API support not available to external accounts → 500.
// Users can opt-in with CORTEX_DISABLE_EXPERIMENTAL_BETAS=false.
// eslint-disable-next-line custom-rules/no-top-level-side-effects
process.env.CORTEX_DISABLE_EXPERIMENTAL_BETAS ??= 'true'

// Bugfix for corepack auto-pinning, which adds yarnpkg to peoples' package.jsons
// eslint-disable-next-line custom-rules/no-top-level-side-effects
process.env.COREPACK_ENABLE_AUTO_PIN = '0';

// Set max heap size for child processes in CCR environments (containers have 16GB)
// eslint-disable-next-line custom-rules/no-top-level-side-effects, custom-rules/no-process-env-top-level, custom-rules/safe-env-boolean-check
if (process.env.CORTEX_REMOTE === 'true') {
  // eslint-disable-next-line custom-rules/no-top-level-side-effects, custom-rules/no-process-env-top-level
  const existing = process.env.NODE_OPTIONS || '';
  // eslint-disable-next-line custom-rules/no-top-level-side-effects, custom-rules/no-process-env-top-level
  process.env.NODE_OPTIONS = existing ? `${existing} --max-old-space-size=8192` : '--max-old-space-size=8192';
}

// Harness-science L0 ablation baseline. Inlined here (not init.ts) because
// BashTool/AgentTool/PowerShellTool capture DISABLE_BACKGROUND_TASKS into
// module-level consts at import time — init() runs too late. feature() gate
// DCEs this entire block from external builds.
// eslint-disable-next-line custom-rules/no-top-level-side-effects, custom-rules/no-process-env-top-level
if (feature('ABLATION_BASELINE') && process.env.CORTEX_ABLATION_BASELINE) {
  for (const k of ['CORTEX_SIMPLE', 'CORTEX_DISABLE_THINKING', 'DISABLE_INTERLEAVED_THINKING', 'DISABLE_COMPACT', 'DISABLE_AUTO_COMPACT', 'CORTEX_DISABLE_AUTO_MEMORY', 'CORTEX_DISABLE_BACKGROUND_TASKS']) {
    // eslint-disable-next-line custom-rules/no-top-level-side-effects, custom-rules/no-process-env-top-level
    process.env[k] ??= '1';
  }
}

/**
 * Bootstrap entrypoint - checks for special flags before loading the full CLI.
 * All imports are dynamic to minimize module evaluation for fast paths.
 * Fast-path for --version has zero imports beyond this file.
 */
async function main(): Promise<void> {
  const args = process.argv.slice(2);

  // Fast-path for --version/-v: zero module loading needed
  if (args.length === 1 && (args[0] === '--version' || args[0] === '-v' || args[0] === '-V')) {
    // MACRO.VERSION is inlined at build time
    const v = (typeof MACRO !== 'undefined' ? (MACRO.DISPLAY_VERSION ?? MACRO.VERSION) : '99.0.0-dev');
    // biome-ignore lint/suspicious/noConsole:: intentional console output
    console.log(`${v} (CORTEX)`);
    return;
  }

  // --provider: set provider env vars early so saved-profile resolution,
  // validation, and the startup banner all see the intended provider/model.
  if (args.includes('--provider')) {
    const { applyProviderFlagFromArgs } = await import('../utils/providerFlag.js');
    const result = applyProviderFlagFromArgs(args);
    if (result?.error) {
      // biome-ignore lint/suspicious/noConsole:: intentional error output
      console.error(`Error: ${result.error}`);
      process.exit(1);
    }
  }

  {
    const { enableConfigs } = await import('../utils/config.js')
    enableConfigs()
    const { applySafeConfigEnvironmentVariables } = await import('../utils/managedEnv.js')
    applySafeConfigEnvironmentVariables()
    const { hydrateGeminiAccessTokenFromSecureStorage } = await import('../utils/geminiCredentials.js')
    hydrateGeminiAccessTokenFromSecureStorage()
    const { hydrateGithubModelsTokenFromSecureStorage } = await import('../utils/githubModelsCredentials.js')
    hydrateGithubModelsTokenFromSecureStorage()
    
  }

  const startupEnv = await buildStartupEnvFromProfile({
    processEnv: process.env,
  })
  if (startupEnv !== process.env) {
    const startupProfileError = await getProviderValidationError(startupEnv)
    if (startupProfileError) {
      console.error(
        `Warning: ignoring saved provider profile. ${startupProfileError}`,
      )
    } else {
      applyProfileEnvToProcessEnv(process.env, startupEnv)
    }
  }

  await validateProviderEnvOrExit()

  // Print the gradient startup screen before the Ink UI loads
  const { printStartupScreen } = await import('../components/StartupScreen.js')
  await printStartupScreen()

  // Auto-start the shared-session server so teammates can join via URL / QR.
  // Session-bound: every CLI start gets a fresh session id, so old invite links
  // automatically stop working. Tunnel is default-on (tries cloudflared →
  // localhost.run → serveo); opt out with CORTEX_NO_SHARE=1 or
  // CORTEX_NO_SHARE_TUNNEL=1.
  if (process.env.CORTEX_NO_SHARE !== '1') {
    try {
      const { ensureShareServer } = await import('../commands/share/share.js')
      const handle = await ensureShareServer()
      // @ts-expect-error - qrcode ships without bundled types
      const { toString: qrToString } = await import('qrcode')
      const DIM = '\x1b[2m', BOLD = '\x1b[1m', GREEN = '\x1b[32m', CYAN = '\x1b[36m', MAGENTA = '\x1b[35m', YELLOW = '\x1b[33m', RESET = '\x1b[0m'

      const printBanner = async (url: string, scopeLabel: string) => {
        const qr: string = await qrToString(url, { type: 'utf8', errorCorrectionLevel: 'L' })
        process.stderr.write(
          `\n${GREEN}${BOLD}● shared session ready${RESET}  ${DIM}scope:${RESET} ${scopeLabel}\n` +
          `${DIM}  session id:${RESET} ${BOLD}${handle.sessionId}${RESET} ${DIM}(rotates every CLI start — old invites stop working)${RESET}\n` +
          `  ${BOLD}Share this:${RESET}  ${MAGENTA}${url}${RESET}\n` +
          `  ${DIM}Local:${RESET}       ${CYAN}${handle.url}${RESET}\n` +
          `  ${DIM}LAN:${RESET}         ${CYAN}${handle.lanUrl}${RESET}\n` +
          `  ${DIM}QR:${RESET}          ${CYAN}${handle.url}qr.png${RESET}  ${DIM}·${RESET}  ${CYAN}${handle.url}qr.svg${RESET}\n\n` +
          qr.split('\n').filter((l: string) => l.length > 0).map((l: string) => '    ' + l).join('\n') + '\n' +
          `  ${DIM}/share stop to end · /share to re-show this panel${RESET}\n\n`,
        )
      }

      // Print LAN banner immediately, then upgrade to GLOBAL once the tunnel connects.
      await printBanner(handle.shareUrl, `${YELLOW}LAN${RESET} ${DIM}(spinning up global tunnel…)${RESET}`)

      if (process.env.CORTEX_NO_SHARE_TUNNEL !== '1') {
        void handle.startTunnel().then(async (pub: string | null) => {
          if (pub) {
            await printBanner(handle.shareUrl, `${MAGENTA}${BOLD}GLOBAL${RESET} ${DIM}(anywhere in the world · ${handle.tunnelProvider})${RESET}`)
          } else {
            process.stderr.write(
              `${YELLOW}⚠  Could not establish a global tunnel.${RESET} ${DIM}Teammates must be on the same LAN, or install a tunnel tool:${RESET}\n` +
              `  ${CYAN}brew install cloudflared${RESET}  ${DIM}(recommended — HTTPS, no signup)${RESET}\n\n`,
            )
          }
        })
      }
    } catch {
      // swallow — share server is a non-critical convenience
    }
  }

  // For all other paths, load the startup profiler
  const {
    profileCheckpoint
  } = await import('../utils/startupProfiler.js');
  profileCheckpoint('cli_entry');

  // Fast-path for --dump-system-prompt: output the rendered system prompt and exit.
  // Used by prompt sensitivity evals to extract the system prompt at a specific commit.
  // Ant-only: eliminated from external builds via feature flag.
  if (feature('DUMP_SYSTEM_PROMPT') && args[0] === '--dump-system-prompt') {
    profileCheckpoint('cli_dump_system_prompt_path');
    const {
      enableConfigs
    } = await import('../utils/config.js');
    enableConfigs();
    const {
      getMainLoopModel
    } = await import('../utils/model/model.js');
    const modelIdx = args.indexOf('--model');
    const model = modelIdx !== -1 && args[modelIdx + 1] || getMainLoopModel();
    const {
      getSystemPrompt
    } = await import('../constants/prompts.js');
    const prompt = await getSystemPrompt([], model);
    // biome-ignore lint/suspicious/noConsole:: intentional console output
    console.log(prompt.join('\n'));
    return;
  }
  if (process.argv[2] === '--cortex-in-chrome-mcp') {
    profileCheckpoint('cli_cortex_in_chrome_mcp_path');
    const {
      runCORTEXInChromeMcpServer
    } = await import('../utils/cortexInChrome/mcpServer.js');
    await runCORTEXInChromeMcpServer();
    return;
  } else if (process.argv[2] === '--chrome-native-host') {
    profileCheckpoint('cli_chrome_native_host_path');
    const {
      runChromeNativeHost
    } = await import('../utils/cortexInChrome/chromeNativeHost.js');
    await runChromeNativeHost();
    return;
  } else if (feature('CHICAGO_MCP') && process.argv[2] === '--computer-use-mcp') {
    profileCheckpoint('cli_computer_use_mcp_path');
    const {
      runComputerUseMcpServer
    } = await import('../utils/computerUse/mcpServer.js');
    await runComputerUseMcpServer();
    return;
  }

  // Fast-path for `--daemon-worker=<kind>` (internal — supervisor spawns this).
  // Must come before the daemon subcommand check: spawned per-worker, so
  // perf-sensitive. No enableConfigs(), no analytics sinks at this layer —
  // workers are lean. If a worker kind needs configs/auth (assistant will),
  // it calls them inside its run() fn.
  if (feature('DAEMON') && args[0] === '--daemon-worker') {
    const {
      runDaemonWorker
    } = await import('../daemon/workerRegistry.js');
    await runDaemonWorker(args[1]);
    return;
  }

  // Fast-path for `cortex remote-control` (also accepts legacy `cortex remote` / `cortex sync` / `cortex bridge`):
  // serve local machine as bridge environment.
  // feature() must stay inline for build-time dead code elimination;
  // isBridgeEnabled() checks the runtime GrowthBook gate.
  if (feature('BRIDGE_MODE') && (args[0] === 'remote-control' || args[0] === 'rc' || args[0] === 'remote' || args[0] === 'sync' || args[0] === 'bridge')) {
    profileCheckpoint('cli_bridge_path');
    const {
      enableConfigs
    } = await import('../utils/config.js');
    enableConfigs();
    const {
      getBridgeDisabledReason,
      checkBridgeMinVersion
    } = await import('../bridge/bridgeEnabled.js');
    const {
      BRIDGE_LOGIN_ERROR
    } = await import('../bridge/types.js');
    const {
      bridgeMain
    } = await import('../bridge/bridgeMain.js');
    const {
      exitWithError
    } = await import('../utils/process.js');

    // Auth check must come before the GrowthBook gate check — without auth,
    // GrowthBook has no user context and would return a stale/default false.
    // getBridgeDisabledReason awaits GB init, so the returned value is fresh
    // (not the stale disk cache), but init still needs auth headers to work.
    const {
      getCORTEXAIOAuthTokens
    } = await import('../utils/auth.js');
    if (!getCORTEXAIOAuthTokens()?.accessToken) {
      exitWithError(BRIDGE_LOGIN_ERROR);
    }
    const disabledReason = await getBridgeDisabledReason();
    if (disabledReason) {
      exitWithError(`Error: ${disabledReason}`);
    }
    const versionError = checkBridgeMinVersion();
    if (versionError) {
      exitWithError(versionError);
    }

    // Bridge is a remote control feature - check policy limits
    const {
      waitForPolicyLimitsToLoad,
      isPolicyAllowed
    } = await import('../services/policyLimits/index.js');
    await waitForPolicyLimitsToLoad();
    if (!isPolicyAllowed('allow_remote_control')) {
      exitWithError("Error: Remote Control is disabled by your organization's policy.");
    }
    await bridgeMain(args.slice(1));
    return;
  }

  // Fast-path for `cortex daemon [subcommand]`: long-running supervisor.
  if (feature('DAEMON') && args[0] === 'daemon') {
    profileCheckpoint('cli_daemon_path');
    const {
      enableConfigs
    } = await import('../utils/config.js');
    enableConfigs();
    const {
      initSinks
    } = await import('../utils/sinks.js');
    initSinks();
    const {
      daemonMain
    } = await import('../daemon/main.js');
    await daemonMain(args.slice(1));
    return;
  }

  // Fast-path for `cortex ps|logs|attach|kill` and `--bg`/`--background`.
  // Session management against the ~/.cortex/sessions/ registry. Flag
  // literals are inlined so bg.js only loads when actually dispatching.
  if (feature('BG_SESSIONS') && (args[0] === 'ps' || args[0] === 'logs' || args[0] === 'attach' || args[0] === 'kill' || args.includes('--bg') || args.includes('--background'))) {
    profileCheckpoint('cli_bg_path');
    const {
      enableConfigs
    } = await import('../utils/config.js');
    enableConfigs();
    const bg = await import('../cli/bg.js');
    switch (args[0]) {
      case 'ps':
        await bg.psHandler(args.slice(1));
        break;
      case 'logs':
        await bg.logsHandler(args[1]);
        break;
      case 'attach':
        await bg.attachHandler(args[1]);
        break;
      case 'kill':
        await bg.killHandler(args[1]);
        break;
      default:
        await bg.handleBgFlag(args);
    }
    return;
  }

  // Fast-path for template job commands.
  if (feature('TEMPLATES') && (args[0] === 'new' || args[0] === 'list' || args[0] === 'reply')) {
    profileCheckpoint('cli_templates_path');
    const {
      templatesMain
    } = await import('../cli/handlers/templateJobs.js');
    await templatesMain(args);
    // process.exit (not return) — mountFleetView's Ink TUI can leave event
    // loop handles that prevent natural exit.
    // eslint-disable-next-line custom-rules/no-process-exit
    process.exit(0);
  }

  // Fast-path for `cortex environment-runner`: headless BYOC runner.
  // feature() must stay inline for build-time dead code elimination.
  if (feature('BYOC_ENVIRONMENT_RUNNER') && args[0] === 'environment-runner') {
    profileCheckpoint('cli_environment_runner_path');
    const {
      environmentRunnerMain
    } = await import('../environment-runner/main.js');
    await environmentRunnerMain(args.slice(1));
    return;
  }

  // Fast-path for `cortex self-hosted-runner`: headless self-hosted-runner
  // targeting the SelfHostedRunnerWorkerService API (register + poll; poll IS
  // heartbeat). feature() must stay inline for build-time dead code elimination.
  if (feature('SELF_HOSTED_RUNNER') && args[0] === 'self-hosted-runner') {
    profileCheckpoint('cli_self_hosted_runner_path');
    const {
      selfHostedRunnerMain
    } = await import('../self-hosted-runner/main.js');
    await selfHostedRunnerMain(args.slice(1));
    return;
  }

  // Fast-path for --worktree --tmux: exec into tmux before loading full CLI
  const hasTmuxFlag = args.includes('--tmux') || args.includes('--tmux=classic');
  if (hasTmuxFlag && (args.includes('-w') || args.includes('--worktree') || args.some(a => a.startsWith('--worktree=')))) {
    profileCheckpoint('cli_tmux_worktree_fast_path');
    const {
      enableConfigs
    } = await import('../utils/config.js');
    enableConfigs();
    const {
      isWorktreeModeEnabled
    } = await import('../utils/worktreeModeEnabled.js');
    if (isWorktreeModeEnabled()) {
      const {
        execIntoTmuxWorktree
      } = await import('../utils/worktree.js');
      const result = await execIntoTmuxWorktree(args);
      if (result.handled) {
        return;
      }
      // If not handled (e.g., error), fall through to normal CLI
      if (result.error) {
        const {
          exitWithError
        } = await import('../utils/process.js');
        exitWithError(result.error);
      }
    }
  }

  // Redirect common update flag mistakes to the update subcommand
  if (args.length === 1 && (args[0] === '--update' || args[0] === '--upgrade')) {
    process.argv = [process.argv[0]!, process.argv[1]!, 'update'];
  }

  // --bare: set SIMPLE early so gates fire during module eval / commander
  // option building (not just inside the action handler).
  if (args.includes('--bare')) {
    process.env.CORTEX_SIMPLE = '1';
  }

  // No special flags detected, load and run the full CLI
  if (process.env.CORTEX_DISABLE_EARLY_INPUT !== '1') {
    const {
      startCapturingEarlyInput
    } = await import('../utils/earlyInput.js');
    startCapturingEarlyInput();
  }
  profileCheckpoint('cli_after_main_import');

  // OpenBB monitor removed — was causing browser pop-ups to 127.0.0.1:6900

  const {
    main: cliMain
  } = await import('../main.js');
  profileCheckpoint('cli_after_main_import');

  // Auto-launch web dashboard in background (unless explicitly disabled)
  if (process.env.CORTEX_WEB_AUTO_OPEN !== 'false') {
    const { spawn } = await import('child_process');
    const { resolve } = await import('path');
    const webScript = resolve(process.cwd(), 'bin', 'AGI-web');
    spawn(webScript, [], {
      detached: true,
      stdio: 'ignore',
      env: { ...process.env, CORTEX_AUTO_OPEN: 'true' }
    }).unref();
  }

  await cliMain();
  profileCheckpoint('cli_after_main_complete');
}

// eslint-disable-next-line custom-rules/no-top-level-side-effects
void main();
