const { configure, processCLIArgs, run } = require('@japa/runner')
const { assert } = require('@japa/assert')

processCLIArgs(process.argv.splice(2))
configure({
  files: ['tests/**/*.spec.js'],
  plugins: [assert()],
})

run()
