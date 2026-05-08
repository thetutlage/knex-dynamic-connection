/*
 * knex-dynamic-connection
 *
 * (c) Harminder Virk <virk@adonisjs.com>
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

const knex = require('knex')
const { test } = require('@japa/runner')
const { setHiddenProperty } = require('knex/lib/util/security.js')
const { patchKnex } = require('../index.js')
const dotenv = require('dotenv')

dotenv.config()

/**
 * Sleep for a given time
 */
function sleep(time) {
  return new Promise((resolve) => setTimeout(resolve, time))
}

function getKnexConfig() {
  switch (process.env.DIALECT) {
    case 'pg':
      return {
        client: 'pg',
        connection: {
          host: process.env.PG_HOST,
          port: Number(process.env.PG_PORT),
          user: process.env.PG_USER,
          database: process.env.PG_DATABASE,
          password: process.env.PG_PASSWORD,
        },
        pool: {
          min: 0,
          idleTimeoutMillis: 300,
        },
      }
    case 'mysql':
      return {
        client: 'mysql',
        connection: {
          host: process.env.LEGACY_MYSQL_HOST,
          port: Number(process.env.LEGACY_MYSQL_PORT),
          user: process.env.LEGACY_MYSQL_USER,
          database: process.env.LEGACY_MYSQL_DATABASE,
          password: process.env.LEGACY_MYSQL_PASSWORD,
        },
        pool: {
          min: 0,
          idleTimeoutMillis: 300,
        },
      }
    case 'mysql2':
      return {
        client: 'mysql2',
        connection: {
          host: process.env.LEGACY_MYSQL_HOST,
          port: Number(process.env.LEGACY_MYSQL_PORT),
          user: process.env.LEGACY_MYSQL_USER,
          database: process.env.LEGACY_MYSQL_DATABASE,
          password: process.env.LEGACY_MYSQL_PASSWORD,
        },
        pool: {
          min: 0,
          idleTimeoutMillis: 300,
        },
      }
    case 'mssql':
      return {
        client: 'mssql',
        connection: {
          server: process.env.MSSQL_HOST,
          port: Number(process.env.MSSQL_PORT),
          user: process.env.MSSQL_USER,
          password: process.env.MSSQL_PASSWORD,
        },
        pool: {
          min: 0,
          idleTimeoutMillis: 300,
        },
      }
    default:
      throw new Error('Define process.env.DIALECT before running tests')
  }
}

function getKnexConfigReplica() {
  switch (process.env.DIALECT) {
    case 'pg':
      return {
        client: 'pg',
        connection: {
          host: process.env.PG_READ_REPLICA_HOST,
          port: Number(process.env.PG_READ_REPLICA_PORT),
          user: process.env.PG_READ_REPLICA_USER,
          database: process.env.PG_READ_REPLICA_DATABASE,
          password: process.env.PG_READ_REPLICA_PASSWORD,
        },
        pool: {
          min: 0,
          idleTimeoutMillis: 300,
        },
      }
    case 'mysql':
      return {
        client: 'mysql',
        connection: {
          host: process.env.LEGACY_MYSQL_READ_REPLICA_HOST,
          port: Number(process.env.LEGACY_MYSQL_READ_REPLICA_PORT),
          user: process.env.LEGACY_MYSQL_READ_REPLICA_USER,
          database: process.env.LEGACY_MYSQL_READ_REPLICA_DATABASE,
          password: process.env.LEGACY_MYSQL_READ_REPLICA_PASSWORD,
        },
        pool: {
          min: 0,
          idleTimeoutMillis: 300,
        },
      }
    case 'mysql2':
      return {
        client: 'mysql2',
        connection: {
          host: process.env.LEGACY_MYSQL_READ_REPLICA_HOST,
          port: Number(process.env.LEGACY_MYSQL_READ_REPLICA_PORT),
          user: process.env.LEGACY_MYSQL_READ_REPLICA_USER,
          database: process.env.LEGACY_MYSQL_READ_REPLICA_DATABASE,
          password: process.env.LEGACY_MYSQL_READ_REPLICA_PASSWORD,
        },
        pool: {
          min: 0,
          idleTimeoutMillis: 300,
        },
      }
    case 'mssql':
      return {
        client: 'mssql',
        connection: {
          server: process.env.MSSQL_READ_REPLICA_HOST,
          port: Number(process.env.MSSQL_READ_REPLICA_PORT),
          user: process.env.MSSQL_READ_REPLICA_USER,
          password: process.env.MSSQL_READ_REPLICA_PASSWORD,
        },
        pool: {
          min: 0,
          idleTimeoutMillis: 300,
        },
      }
    default:
      throw new Error('Define process.env.DIALECT before running tests')
  }
}

test.group('Patch knex', (group) => {
  group.setup(async () => {
    const knexInstance = knex(getKnexConfig())
    const knexReplicaInstance = knex(getKnexConfigReplica())

    await knexInstance.schema.dropTableIfExists('users')
    await knexReplicaInstance.schema.dropTableIfExists('users')

    await knexInstance.schema.createTable('users', (table) => {
      table.increments('id')
      table.string('username')
      table.timestamps()
    })

    await knexReplicaInstance.schema.createTable('users', (table) => {
      table.increments('id')
      table.string('username')
      table.timestamps()
    })

    return async () => {
      await knexInstance.schema.dropTable('users')
      await knexReplicaInstance.schema.dropTable('users')
      await knexInstance.destroy()
      await knexReplicaInstance.destroy()
    }
  })

  test('pass config to the resolver function', async ({ assert, cleanup }) => {
    assert.plan(1)

    const knexInstance = knex(getKnexConfig())
    cleanup(() => knexInstance.destroy())

    patchKnex(knexInstance, (config) => {
      const registeredConfig = getKnexConfig().connection
      setHiddenProperty(registeredConfig)

      assert.deepEqual(config.connection, registeredConfig)
      return config.connection
    })

    await knexInstance.select('*').from('users')
  })

  test('use resolver when making raw query', async ({ assert, cleanup }) => {
    assert.plan(1)

    const knexInstance = knex(getKnexConfig())
    cleanup(() => knexInstance.destroy())

    patchKnex(knexInstance, (config) => {
      const registeredConfig = getKnexConfig().connection
      setHiddenProperty(registeredConfig)

      assert.deepEqual(config.connection, registeredConfig)
      return config.connection
    })

    await knexInstance.raw('SELECT 1 + 1;')
  })

  test('use resolver when acquiring connection for transaction', async ({ assert, cleanup }) => {
    assert.plan(1)

    const knexInstance = knex(getKnexConfig())
    cleanup(() => knexInstance.destroy())

    patchKnex(knexInstance, (config) => {
      const registeredConfig = getKnexConfig().connection
      setHiddenProperty(registeredConfig)

      assert.deepEqual(config.connection, registeredConfig)
      return config.connection
    })

    const trx = await knexInstance.transaction()
    await trx.commit()
  })

  test('use resolver when acquiring connection for schema', async ({ assert, cleanup }) => {
    assert.plan(1)

    const knexInstance = knex(getKnexConfig())
    cleanup(() => knexInstance.destroy())

    patchKnex(knexInstance, (config) => {
      const registeredConfig = getKnexConfig().connection
      setHiddenProperty(registeredConfig)

      assert.deepEqual(config.connection, registeredConfig)
      return config.connection
    })

    await knexInstance.schema.hasTable('users')
  })

  test('make requests using resolver connection settings', async ({ assert, cleanup }) => {
    let counter = 0

    const knexInstance = knex(getKnexConfig())
    cleanup(() => knexInstance.destroy())

    patchKnex(knexInstance, (config) => {
      counter++
      if (counter === 2) {
        return getKnexConfigReplica().connection
      }

      return config.connection
    })

    await knexInstance.table('users').insert({ username: 'virk' })

    /**
     * Sleeping for a while, so that the pool will releases the unused
     * connection and the callback to compute connection settings
     * will re-trigger.
     */
    await sleep(1000)
    const users = await knexInstance.table('users').select('*')

    await sleep(1000)
    await knexInstance('users').truncate()

    assert.lengthOf(users, 0)
  }).timeout(6000)

  test('support async connection property in knex config', async ({ assert, cleanup }) => {
    assert.plan(2)

    let resolverCalls = 0
    const baseConfig = getKnexConfig()

    const knexInstance = knex({
      ...baseConfig,
      connection: async () => {
        resolverCalls++
        return baseConfig.connection
      },
    })
    cleanup(() => knexInstance.destroy())

    patchKnex(knexInstance, (config) => {
      return typeof config.connection === 'function' ? config.connection() : config.connection
    })

    const result = await knexInstance.raw('SELECT 1 + 1 AS sum;')
    assert.exists(result)
    assert.isAbove(resolverCalls, 0)
  })

  test('switch hosts via async connection property', async ({ assert, cleanup }) => {
    let counter = 0
    const baseConfig = getKnexConfig()
    const replicaConnection = getKnexConfigReplica().connection

    const knexInstance = knex({
      ...baseConfig,
      connection: async () => {
        counter++
        if (counter === 2) {
          return replicaConnection
        }
        return baseConfig.connection
      },
    })
    cleanup(() => knexInstance.destroy())

    patchKnex(knexInstance, (config) => config.connection())

    await knexInstance.table('users').insert({ username: 'virk' })

    /**
     * Sleeping for a while, so that the pool will releases the unused
     * connection and the callback to compute connection settings
     * will re-trigger.
     */
    await sleep(1000)
    const users = await knexInstance.table('users').select('*')

    await sleep(1000)
    await knexInstance('users').truncate()

    assert.lengthOf(users, 0)
  }).timeout(6000)

  test('do not re-acquire connection in transaction', async ({ assert, cleanup }) => {
    let counter = 0

    const knexInstance = knex(getKnexConfig())
    cleanup(() => knexInstance.destroy())

    patchKnex(knexInstance, (config) => {
      counter++
      if (counter === 2) {
        return getKnexConfigReplica().connection
      }
      return config.connection
    })

    const trx = await knexInstance.transaction()
    await trx.table('users').insert({ username: 'virk' })

    await sleep(1000)
    const users = await trx.table('users').select('*')
    await trx.rollback()

    assert.lengthOf(users, 1)
    assert.equal(counter, 1)
  }).timeout(6000)

  test('cache settings while expirationChecker returns false', async ({ assert, cleanup }) => {
    let configCalls = 0
    let expired = false

    const knexInstance = knex(getKnexConfig())
    cleanup(() => knexInstance.destroy())

    patchKnex(knexInstance, async () => {
      configCalls++
      return {
        ...getKnexConfig().connection,
        expirationChecker: () => expired,
      }
    })

    await knexInstance.raw('SELECT 1 + 1 AS sum;')

    /**
     * Sleeping so the pool releases the idle connection. A fresh acquire
     * triggers `getRuntimeConnectionSettings` again — but the cached
     * settings should be reused since the checker still returns false.
     */
    await sleep(1000)
    await knexInstance.raw('SELECT 1 + 1 AS sum;')

    assert.equal(configCalls, 1)

    /**
     * Flip the flag — checker now returns true. Next acquire must
     * re-invoke `configFn` to refresh credentials.
     */
    expired = true
    await sleep(1000)
    await knexInstance.raw('SELECT 1 + 1 AS sum;')

    assert.equal(configCalls, 2)
  }).timeout(8000)
})
