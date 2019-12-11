/*
* knex-dynamic-connection
*
* (c) Harminder Virk <virk@adonisjs.com>
*
* For the full copyright and license information, please view the LICENSE
* file that was distributed with this source code.
*/

import Bluebird from 'bluebird'

/**
 * Copy of `acquireRawConnection` from knex codebase, but instead relies
 * on `getRuntimeConnectionSettings` vs `connectionSettings`
 */
export function acquireRawConnection (): Promise<any> {
  return new Bluebird((resolver, rejecter) => {
    const settings = Object.assign({}, this.getRuntimeConnectionSettings())
    settings.pool = this.mssqlPoolSettings

    const connection = new this.driver.ConnectionPool(settings)
    connection.connect((err: Error) => {
      if (err) {
        return rejecter(err)
      }

      connection.on('error', (error: Error) => {
        connection.__knex__disposed = error
      })

      resolver(connection)
    })
  })
}
