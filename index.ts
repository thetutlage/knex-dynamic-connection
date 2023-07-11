/*
 * knex-dynamic-connection
 *
 * (c) Harminder Virk <virk@adonisjs.com>
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

/**
 * ------------------------------------------------------------------
 * Source of truth
 * ------------------------------------------------------------------
 *
 * Since, we are patching a part of the knex codebase, let's keep this
 * block as a source of truth around what is happening
 *
 * Last modified: 25th Feb, 2021
 *
 * The MYSQL2 dialect of knex instead the MYSQL dialect. Therefore the patch
 * function for both the dialects is same. ('./src/dialects/mysql.ts')
 * https://github.com/knex/knex/blob/master/lib/dialects/mysql2/index.js
 *
 * MSSQL needs a little more changes. 99% code is still a copy/paste. It's
 * just we have to copy/paste more code.
 *
 * PostgreSQL is simple and just requires one line of change. Redshit extends
 * PostgreSQL, so the patch function for both is same
 *
 * SQLITE doesn't have a concept of read/write replicas
 *
 * OracleDB is a beast. We have literally copy a lot of code. The good thing is,
 * we still have one line of code change. Rest is just a copy/paste
 */

import { Knex } from 'knex'
import { resolveClientNameWithAliases } from 'knex/lib/util/helpers'

/**
 * Dialects with their `acquireRawConnection` implementation
 */
const dialects = {
  mssql: 'mssql',
  mysql: 'mysql',
  mysql2: 'mysql',
  oracledb: 'oracledb',
  postgres: 'pg',
  pgnative: 'pg',
  redshift: 'pg',
}

/**
 * Patches the knex client so that it makes use of a resolver function to
 * resolve the config before making a SQL query.
 */
export function patchKnex(
  knex: Knex,
  configFn: (config: Knex.Config) => Knex.ConnectionConfig
): void {
  const client = knex.client
  const clientName = resolveClientNameWithAliases(client.config.client)

  /**
   * Do not patch for sqlite3
   */
  if (['sqlite3', 'better-sqlite3'].includes(clientName)) {
    return
  }

  /**
   * Do not patch for oracle. The dialect is dead in the knex code as
   * well.
   * https://github.com/knex/knex/blob/master/lib/dialects/oracle/DEAD_CODE.md
   */
  if (clientName === 'oracle') {
    return
  }

  /**
   * This function is the exact copy of acquire connection from the knex code
   * base, with just handful of following changes.
   *
   * 1. Uses `client.getRuntimeConnectionSettings` vs `client.connectionSettings`
   *    to get a new connection host for read replicas.
   */
  client.acquireRawConnection =
    require(`./src/dialects/${dialects[clientName]}`).acquireRawConnection

  /**
   * Returns a dynamic connection to be used for each query
   */
  client.getRuntimeConnectionSettings =
    function getRuntimeConnectionSettings(): Knex.ConnectionConfig {
      return configFn(this.config)
    }
}
