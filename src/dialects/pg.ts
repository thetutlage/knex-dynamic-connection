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
/* eslint no-shadow: "off" */
export function acquireRawConnection (): Promise<any> {
  const client = this

  return new Promise(function (resolver, rejecter) {
    const connection = new client.driver.Client(client.getRuntimeConnectionSettings())
    connection.connect(function (err: Error, connection: any) {
      if (err) {
        return rejecter(err)
      }

      connection.on('error', (err: Error) => {
        connection.__knex__disposed = err
      })

      connection.on('end', (err: Error) => {
        connection.__knex__disposed = err || 'Connection ended unexpectedly'
      })

      if (!client.version) {
        return client.checkVersion(connection).then(function (version: string) {
          client.version = version
          resolver(connection)
        })
      }

      resolver(connection)
    })
  })
    .then(function setSearchPath (connection) {
      client.setSchemaSearchPath(connection)
      return connection
    })
}
