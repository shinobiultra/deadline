import { execSync } from 'node:child_process'

const status = execSync('git status --porcelain -- docs/screens', { encoding: 'utf8' }).trim()

if (!status) {
  console.log('docs/screens are up to date')
  process.exit(0)
}

console.error('docs/screens changed. run `npm run ui:capture` and commit updated screenshots.')
console.error(status)
process.exit(1)
