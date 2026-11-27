/**
 * Bundle the AimRule client half into the single factory file the module
 * loader expects. React stays out of the bundle: it arrives through the
 * module table at factory time.
 */

import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const require = createRequire(import.meta.url)
const esbuild = require('/Users/kuangjixiang/node_modules/esbuild/lib/main.js')

const here = dirname(fileURLToPath(import.meta.url))

await esbuild.build({
  entryPoints: [join(here, 'src/entry.jsx')],
  outfile: join(here, 'client.js'),
  bundle: true,
  format: 'iife',
  platform: 'browser',
  target: ['chrome110'],
  jsx: 'transform',
  jsxFactory: 'h',
  jsxFragment: 'Fragment',
  legalComments: 'none',
  banner: { js: '/*! AimRule | Copyright (c) 2025-2026 AimRule contributors | AGPL-3.0-or-later */' },
  logLevel: 'info',
})

console.log('built client.js')
