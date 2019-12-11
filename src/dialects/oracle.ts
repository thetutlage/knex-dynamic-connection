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
    const settings = this.getRuntimeConnectionSettings()
    this.driver.connect(settings, (err: Error, connection: any) => {
      if (err) {
        return rejecter(err)
      }

      Bluebird.promisifyAll(connection)

      if (settings.prefetchRowCount) {
        connection.setPrefetchRowCount(settings.prefetchRowCount)
      }
      resolver(connection)
    })
  })
}
