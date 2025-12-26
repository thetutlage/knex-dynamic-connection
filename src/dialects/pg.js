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
function acquireRawConnection() {
  const client = this
  const connection = new client.driver.Client(client.getRuntimeConnectionSettings())
  connection.on('error', (err) => {
    connection.__knex__disposed = err
  })

  connection.on('end', (err) => {
    connection.__knex__disposed = err || 'Connection ended unexpectedly'
  })

  return connection
    .connect()
    .then(() => {
      if (!client.version) {
        return client.checkVersion(connection).then(function (version) {
          client.version = version
          return connection
        })
      }

      return connection
    })
    .then(function setSearchPath(connection) {
      client.setSchemaSearchPath(connection)
      return connection
    })
}

exports.acquireRawConnection = acquireRawConnection
