/*
 * knex-dynamic-connection
 *
 * (c) Harminder Virk <virk@adonisjs.com>
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

import test from 'japa'
import { Knex, default as knex } from 'knex'
import { setHiddenProperty } from 'knex/lib/util/security.js'

import { patchKnex } from '../index'

require('dotenv').config()

/**
 * Sleep for a given time
 */
function sleep(time: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, time))
}

function getKnexConfig(): Knex.Config {
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

function getKnexConfigReplica(): Knex.Config {
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
  group.before(async () => {
    await knex(getKnexConfig()).schema.dropTableIfExists('users')
    await knex(getKnexConfigReplica()).schema.dropTableIfExists('users')

    await knex(getKnexConfig()).schema.createTable('users', (table) => {
      table.increments('id')
      table.string('username')
      table.timestamps()
    })

    await knex(getKnexConfigReplica()).schema.createTable('users', (table) => {
      table.increments('id')
      table.string('username')
      table.timestamps()
    })
  })

  group.after(async () => {
    await knex(getKnexConfig()).schema.dropTable('users')
    await knex(getKnexConfigReplica()).schema.dropTable('users')
  })

  test('pass config to the resolver function', async (assert) => {
    assert.plan(1)

    const knexInstance = knex(getKnexConfig())
    patchKnex(knexInstance, (config) => {
      const registeredConfig = getKnexConfig().connection
      setHiddenProperty(registeredConfig)

      assert.deepEqual(config.connection, registeredConfig)
      return config.connection as Knex.ConnectionConfig
    })

    await knexInstance.select('*').from('users')
  })

  test('use resolver when making raw query', async (assert) => {
    assert.plan(1)

    const knexInstance = knex(getKnexConfig())
    patchKnex(knexInstance, (config) => {
      const registeredConfig = getKnexConfig().connection
      setHiddenProperty(registeredConfig)

      assert.deepEqual(config.connection, registeredConfig)
      return config.connection as Knex.ConnectionConfig
    })

    await knexInstance.raw('SELECT 1 + 1;')
  })

  test('use resolver when acquiring connection for transaction', async (assert) => {
    assert.plan(1)

    const knexInstance = knex(getKnexConfig())
    patchKnex(knexInstance, (config) => {
      const registeredConfig = getKnexConfig().connection
      setHiddenProperty(registeredConfig)

      assert.deepEqual(config.connection, registeredConfig)
      return config.connection as Knex.ConnectionConfig
    })

    await knexInstance.transaction()
  })

  test('use resolver when acquiring connection for schema', async (assert) => {
    assert.plan(1)

    const knexInstance = knex(getKnexConfig())
    patchKnex(knexInstance, (config) => {
      const registeredConfig = getKnexConfig().connection
      setHiddenProperty(registeredConfig)

      assert.deepEqual(config.connection, registeredConfig)
      return config.connection as Knex.ConnectionConfig
    })

    await knexInstance.schema.hasTable('users')
  })

  test('make requests using resolver connection settings', async (assert) => {
    let counter = 0

    const knexInstance = knex(getKnexConfig())
    patchKnex(knexInstance, (config) => {
      counter++
      if (counter === 2) {
        return getKnexConfigReplica().connection as Knex.ConnectionConfig
      }

      return config.connection as Knex.ConnectionConfig
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

  test('do not re-acquire connection in transaction', async (assert) => {
    let counter = 0

    const knexInstance = knex(getKnexConfig())
    patchKnex(knexInstance, (config) => {
      counter++
      if (counter === 2) {
        return getKnexConfigReplica().connection as Knex.ConnectionConfig
      }
      return config.connection as Knex.ConnectionConfig
    })

    const trx = await knexInstance.transaction()
    await trx.table('users').insert({ username: 'virk' })

    await sleep(1000)
    const users = await trx.table('users').select('*')
    await trx.rollback()

    assert.lengthOf(users, 1)
    assert.equal(counter, 1)
  }).timeout(6000)
})
