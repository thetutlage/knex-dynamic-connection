/*
 * knex-dynamic-connection
 *
 * (c) Harminder Virk <virk@adonisjs.com>
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

const { test } = require('@japa/runner')
const pgDialect = require('../src/dialects/pg.js')

/**
 * A connection may only be handed to the pool AFTER `setSchemaSearchPath` has
 * completed. Otherwise the first query runs with the server's default search path
 * and fails with `42P01 relation ... does not exist` for every table outside
 * `public` (see https://github.com/thetutlage/knex-dynamic-connection/issues/34).
 *
 * This test locks the PROMISE CONTRACT: `acquireRawConnection` must not resolve
 * before `setSchemaSearchPath` resolves. It is deterministic (no socket timing
 * involved) and fails if someone removes the `await` again.
 */
test.group('pg acquireRawConnection', () => {
  test('does not resolve the connection before setSchemaSearchPath resolves', async ({ assert }) => {
    let releaseSetSearchPath
    const setSearchPathGate = new Promise((resolve) => {
      releaseSetSearchPath = resolve
    })

    class FakePgClient {
      on() {}
      connect() {
        return Promise.resolve()
      }
    }

    const client = {
      driver: { Client: FakePgClient },
      version: null,
      getRuntimeConnectionSettings: async () => ({ host: 'localhost', port: 5432 }),
      checkVersion: async () => '15.0',
      setSchemaSearchPath: () => setSearchPathGate,
    }

    let resolved = false
    const acquire = pgDialect.acquireRawConnection.call(client).then(() => {
      resolved = true
    })

    // Let connect/checkVersion (microtasks) settle; the connection must NOT have
    // been released yet — setSearchPath is still pending.
    await new Promise((resolve) => setImmediate(resolve))

    assert.isFalse(
      resolved,
      'connection was released before SET search_path finished (missing await)'
    )

    releaseSetSearchPath()
    await acquire

    assert.isTrue(resolved, 'connection should resolve after SET search_path finishes')
  })
})