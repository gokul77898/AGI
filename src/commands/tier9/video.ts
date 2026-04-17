import { makeTierCommand, PKG_TOOLS } from '../_tierHelper.js'

export default makeTierCommand({
  name: 'video',
  aliases: ['vid'],
  description:
    'Generate a short video from text via HuggingFace (HunyuanVideo by default). Usage: /video <prompt>',
  progressMessage: 'generating video',
  allowedTools: [
    ...PKG_TOOLS,
    'Bash(python3:*)',
    'Bash(pip:*)',
    'Bash(open:*)',
    'Read',
  ],
  buildPrompt: (args) => {
    const trimmed = (args ?? '').trim()
    if (!trimmed || trimmed === 'help') {
      return `## /video — Text → MP4

Usage:
  \`/video <prompt>\`                e.g. /video 5s explainer of our auth flow
  \`/video <prompt> --seconds 10\`   longer clip

Model: \`tencent/HunyuanVideo\` (override via CORTEX_VIDEO_MODEL).
Note: video models often require a paid HF tier. Free tier users should
override to a free T2V model or use \`/image\` + ffmpeg locally.`
    }
    return `## CORTEX Video Generation

User invocation: \`/video ${trimmed}\`

Shell out to: \`python3 python/cortex_media.py video ${JSON.stringify(trimmed)}\`

If HF returns 402/403/404 for the video model, gracefully suggest:
1. Override with a free T2V model: \`export CORTEX_VIDEO_MODEL=<free-model>\`
2. Or generate stills with /image and chain with ffmpeg.

Show the final MP4 path and size when successful.`
  },
})
