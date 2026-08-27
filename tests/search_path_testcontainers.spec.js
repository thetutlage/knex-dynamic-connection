/*
 * knex-dynamic-connection
 *
 * (c) Harminder Virk <virk@adonisjs.com>
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

const { test } = require('@japa/runner')
const knex = require('knex')
const { PostgreSqlContainer } = require('@testcontainers/postgresql')
const { patchKnex } = require('../index.js')

/**
 * End-to-end proof, against a real Postgres (testcontainers), that a freshly
 * acquired connection already carries the configured `search_path` — the contract
 * `acquireRawConnection` (pg dialect) has to guarantee. Without the `await` on
 * `setSchemaSearchPath` (the regression fixed in #34) the first query on the
 * connection runs with the server's default search path and fails with `42P01`.
 *
 * Requires Docker (testcontainers). If the daemon is not available the tests are
 * skipped instead of failing.
 */
test.group('search_path on fresh connections (testcontainers, real Postgres)', (group) => {
  let postgres
  let dockerAvailable = true

  group.setup(async () => {
    try {
      postgres = await new PostgreSqlContainer('postgres:16-alpine').start()

      const knexInstance = knex({
        client: 'pg',
        connection: postgres.getConnectionUri(),
      })
      await knexInstance.raw('create schema if not exists tenant')
      await knexInstance.raw('create table if not exists tenant.users (id serial primary key)')
      await knexInstance.destroy()
    } catch (error) {
      dockerAvailable = false
    }

    return async () => {
      if (postgres) await postgres.stop()
    }
  })

  test('a raw acquired connection already has the configured search_path', async ({
    assert,
    skip,
  }) => {
    if (!dockerAvailable) return skip('Docker unavailable — skipping integration test')

    const knexInstance = knex({
      client: 'pg',
      connection: postgres.getConnectionUri(),
      searchPath: ['tenant', 'public'],
    })
    try {
      const connection = await knexInstance.client.acquireRawConnection()
      const result = await connection.query('show search_path')

      assert.equal(result.rows[0].search_path, 'tenant, public')

      // An unqualified query resolves the table inside the configured schema.
      const rows = await connection.query('select * from users')
      assert.isArray(rows.rows)

      await connection.end()
    } finally {
      await knexInstance.destroy()
    }
  }).timeout(30000)

  test('fresh pool connections resolve unqualified queries via the search_path', async ({
    assert,
    skip,
  }) => {
    if (!dockerAvailable) return skip('Docker unavailable — skipping integration test')

    const knexInstance = knex({
      client: 'pg',
      connection: postgres.getConnectionUri(),
      searchPath: ['tenant', 'public'],
      pool: { min: 0, max: 1, idleTimeoutMillis: 200 },
    })
    try {
      // Force connection churn (pool min:0 + short idle): every acquire creates a
      // NEW connection, and each one must resolve the table without qualifying it.
      for (let i = 0; i < 3; i++) {
        await new Promise((resolve) => setTimeout(resolve, 400))
        const rows = await knexInstance.raw('select * from users')
        assert.isArray(rows.rows)
      }
    } finally {
      await knexInstance.destroy()
    }
  }).timeout(30000)
})