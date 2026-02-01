#!/usr/bin/env node

import { existsSync, realpathSync } from 'node:fs'
import { resolve } from 'node:path'
import { Command } from 'commander'
import dotenv from 'dotenv'
import { lockCommand } from './commands/lock.js'
import { statusCommand } from './commands/status.js'
import { unlockCommand } from './commands/unlock.js'

// Load .env.local if not in CI
if (!process.env.CI) {
  const envLocalPath = resolve(process.cwd(), '.env.local')
  if (existsSync(envLocalPath)) {
    // Validate path to prevent symlink attacks
    const realPath = realpathSync(envLocalPath)
    const cwd = realpathSync(process.cwd())
    if (!realPath.startsWith(`${cwd}/`) && realPath !== cwd) {
      console.warn('Warning: .env.local path is outside project directory, skipping')
    } else {
      dotenv.config({ path: envLocalPath })
    }
  }
}

const program = new Command()

program.name('github-merge-lock').description('Lock/unlock GitHub branches via repository rulesets').version('0.1.0')

program.addCommand(lockCommand)
program.addCommand(unlockCommand)
program.addCommand(statusCommand)

program.parse()
