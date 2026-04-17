import { makeTierCommand, PKG_TOOLS, READ_ONLY_TOOLS, SHELL_TOOLS } from '../_tierHelper.js'

export default makeTierCommand({
  name: 'bundle-analyze',
  aliases: ['bundle'],
  description: 'Bundle size breakdown + optimization tips',
  progressMessage: 'analyzing bundle',
  allowedTools: [...READ_ONLY_TOOLS, ...SHELL_TOOLS, ...PKG_TOOLS],
  buildPrompt: () => `## Bundle Analysis Protocol

You are a bundle-optimization expert. Analyze output size:

### 1. Detect bundler
- Webpack, Vite, esbuild, Rollup, Parcel, Turbopack, Bun, Next.js.
- Read build config.

### 2. Build & measure
- Run production build.
- Read output directory sizes (dist/build/out/.next).
- Use bundler's analyzer if available (\`--stats\`, \`--analyze\`).

### 3. Identify heavy modules
- Largest individual chunks
- Biggest node_modules included
- Duplicated dependencies (multiple versions)
- Poly­fills for targets you don't need

### 4. Optimization recommendations
- Lazy-load opportunities (\`import()\`)
- Tree-shake candidates (bulk imports → named)
- Replace heavy deps with lighter alternatives
- Enable compression (brotli/gzip)
- Code-split by route
- Extract common chunks

### Output (Markdown)
\`\`\`
# Bundle Report

Total: <size>  gzipped: <size>

## Top 10 chunks
| Chunk | Raw | Gzip | Top contents |

## Heaviest dependencies
| Package | Size | Replacement? |

## Recommendations
1. <biggest-win first>
2. ...

Estimated size after recommendations: <before> → <after>
\`\`\`

Proceed.`,
})
