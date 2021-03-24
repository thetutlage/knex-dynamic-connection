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
import { patchKnex } from '../index'

/**
 * Sleep for a given time
 */
function sleep (time: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, time))
}

function getKnexConfig (): Knex.Config {
  switch (process.env.DB) {
    case 'pg':
      return {
        client: 'pg',
        connection: {
          host: 'pg',
          port: 5432,
          user: 'virk',
          database: 'lucid',
          password: 'password',
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
          host: 'mysql',
          port: 3306,
          user: 'virk',
          database: 'lucid',
          password: 'password',
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
          host: 'mysql',
          port: 3306,
          user: 'virk',
          database: 'lucid',
          password: 'password',
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
          user: 'sa',
          server: 'mssql',
          password: 'arandom&233password',
        },
        pool: {
          min: 0,
          idleTimeoutMillis: 300,
        },
      }
    default:
      throw new Error('Define process.env.DB before running tests')
  }
}

function getKnexConfigReplica (): Knex.Config {
  switch (process.env.DB) {
    case 'pg':
      return {
        client: 'pg',
        connection: {
          host: 'pg_read',
          port: 5432,
          user: 'virk',
          database: 'lucid',
          password: 'password',
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
          host: 'mysql_read',
          port: 3306,
          user: 'virk',
          database: 'lucid',
          password: 'password',
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
          host: 'mysql_read',
          port: 3306,
          user: 'virk',
          database: 'lucid',
          password: 'password',
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
          server: 'mssql_read',
          port: 1433,
          user: 'sa',
          password: 'arandom&233password',
        },
        pool: {
          min: 0,
          idleTimeoutMillis: 300,
        },
      }
    default:
      throw new Error('Define process.env.DB before running tests')
  }
}

test.group('Patch knex', (group) => {
  group.before(async () => {
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

  test('patch knex client to make use of resolver function for config', async (assert) => {
    assert.plan(1)

    const knexInstance = knex(getKnexConfig())
    patchKnex(knexInstance, (config) => {
      assert.deepEqual(config.connection, getKnexConfig().connection)
      return config.connection as Knex.ConnectionConfig
    })

    await knexInstance.select('*').from('users')
  })

  test('use resolver when making raw query', async (assert) => {
    assert.plan(1)

    const knexInstance = knex(getKnexConfig())
    patchKnex(knexInstance, (config) => {
      assert.deepEqual(config.connection, getKnexConfig().connection)
      return config.connection as Knex.ConnectionConfig
    })

    await knexInstance.raw('SELECT 1 + 1;')
  })

  test('use resolver when acquiring connection for transaction', async (assert) => {
    assert.plan(1)

    const knexInstance = knex(getKnexConfig())
    patchKnex(knexInstance, (config) => {
      assert.deepEqual(config.connection, getKnexConfig().connection)
      return config.connection as Knex.ConnectionConfig
    })

    await knexInstance.transaction()
  })

  test('use resolver when acquiring connection for schema', async (assert) => {
    assert.plan(1)

    const knexInstance = knex(getKnexConfig())
    patchKnex(knexInstance, (config) => {
      assert.deepEqual(config.connection, getKnexConfig().connection)
      return config.connection as Knex.ConnectionConfig
    })

    await knexInstance.schema.hasTable('users')
  })

  test('make request using resolver connection settings', async (assert) => {
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
     * Sleeping for a while, so that the pool will release the unused
     * connection
     */
    await sleep(1000)
    const users = await knexInstance.table('users').select('*')

    await sleep(1000)
    await knex('users').truncate()

    assert.lengthOf(users, 0)
  }).timeout(6000)

  test('re-use same connection when in transaction', async (assert) => {
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
  }).timeout(6000)
})
