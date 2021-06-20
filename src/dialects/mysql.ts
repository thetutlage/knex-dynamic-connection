/*
 * knex-dynamic-connection
 *
 * (c) Harminder Virk <virk@adonisjs.com>
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

/**
 * Copy of `acquireRawConnection` from knex codebase, but instead relies
 * on `getRuntimeConnectionSettings` vs `connectionSettings`
 */
export function acquireRawConnection(): Promise<any> {
  return new Promise((resolver, rejecter) => {
    const connection = this.driver.createConnection(this.getRuntimeConnectionSettings())
    connection.on('error', (err: Error) => {
      connection.__knex__disposed = err
    })

    connection.connect((err: Error) => {
      if (err) {
        // if connection is rejected, remove listener that was registered above...
        connection.removeAllListeners()
        return rejecter(err)
      }

      resolver(connection)
    })
  })
}
