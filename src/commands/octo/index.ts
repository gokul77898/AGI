import type { Command } from '../../commands.js'

const octo = {
  type: 'local',
  name: 'octo',
  description: 'Open the Cortex (Octogent) multi-agent UI in your browser',
  aliases: ['octogent', 'ui'],
  supportsNonInteractive: true,
  load: () => import('./octo.js'),
} satisfies Command

export default octo
