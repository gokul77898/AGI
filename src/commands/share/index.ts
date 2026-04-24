import type { Command } from '../../commands.js'

const share = {
  type: 'local',
  name: 'share',
  description:
    'Start a shared local-network session so up to 4 teammates can join via URL and queue tasks sequentially',
  aliases: ['collab', 'multiplayer'],
  supportsNonInteractive: true,
  isEnabled: () => true,
  isHidden: false,
  load: () => import('./share.js'),
} satisfies Command

export default share
