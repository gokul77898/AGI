import { makeTierCommand, PKG_TOOLS } from '../_tierHelper.js'

export default makeTierCommand({
  name: 'image',
  aliases: ['img'],
  description:
    'Generate an image from text via HuggingFace FLUX. Usage: /image <prompt>',
  progressMessage: 'generating image',
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
      return `## /image — Text → PNG via HuggingFace FLUX

Usage:
  \`/image <prompt>\`                e.g. /image cyberpunk cat at sunset
  \`/image <prompt> -o foo.png\`     custom output path

Model: \`black-forest-labs/FLUX.1-schnell\` (override with CORTEX_IMAGE_MODEL).
Output saved to \`data/media/\` and auto-opened on macOS.`
    }
    return `## CORTEX Image Generation

User invocation: \`/image ${trimmed}\`

Shell out to: \`python3 python/cortex_media.py image ${JSON.stringify(trimmed)}\`

After running, show:
1. The exact shell command executed
2. The output path (from stdout)
3. File size + elapsed ms

If HF returns 401/403, tell the user their HF_TOKEN may not have access to FLUX and suggest setting \`CORTEX_IMAGE_MODEL\` to another free image model.`
  },
})
