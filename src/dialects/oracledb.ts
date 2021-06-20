/* eslint-disable @typescript-eslint/no-shadow */
/*
 * knex-dynamic-connection
 *
 * (c) Harminder Virk <virk@adonisjs.com>
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

import stream from 'stream'
import { promisify } from 'util'
import { isConnectionError } from 'knex/lib/dialects/oracledb/utils'

/**
 * Copy/pasted as it is from
 * https://github.com/knex/knex/blob/master/lib/dialects/oracledb/index.js#L466
 */
const lobProcessing = function (stream) {
  const oracledb = require('oracledb')

  /**
   * @type 'string' | 'buffer'
   */
  let type: any

  if (stream.type) {
    // v1.2-v4
    if (stream.type === oracledb.BLOB) {
      type = 'buffer'
    } else if (stream.type === oracledb.CLOB) {
      type = 'string'
    }
  } else if (stream.iLob) {
    // v1
    if (stream.iLob.type === oracledb.CLOB) {
      type = 'string'
    } else if (stream.iLob.type === oracledb.BLOB) {
      type = 'buffer'
    }
  } else {
    throw new Error('Unrecognized oracledb lob stream type')
  }
  if (type === 'string') {
    stream.setEncoding('utf-8')
  }
  return readStream(stream, type)
}

/**
 * Copy/pasted as it is from
 * https://github.com/knex/knex/blob/master/lib/dialects/oracledb/index.js#L424
 */
function resolveConnectString(connectionSettings: any) {
  if (connectionSettings.connectString) {
    return connectionSettings.connectString
  }

  if (!connectionSettings.port) {
    return connectionSettings.host + '/' + connectionSettings.database
  }

  return connectionSettings.host + ':' + connectionSettings.port + '/' + connectionSettings.database
}

/**
 * Copy/pasted as it is from
 * https://github.com/knex/knex/blob/master/lib/dialects/oracledb/index.js#L442
 */
function readStream(stream, type) {
  return new Promise((resolve, reject) => {
    let data = type === 'string' ? '' : Buffer.alloc(0)

    stream.on('error', function (err) {
      reject(err)
    })
    stream.on('data', function (chunk) {
      if (type === 'string') {
        data += chunk
      } else {
        data = Buffer.concat([data, chunk])
      }
    })
    stream.on('end', function () {
      resolve(data)
    })
  })
}

/**
 * Copy of `acquireRawConnection` from knex codebase, but instead relies
 * on `getRuntimeConnectionSettings` vs `connectionSettings`
 */
export function acquireRawConnection(): Promise<any> {
  const client = this

  const asyncConnection = new Promise(function (resolver, rejecter) {
    const settings = client.getRuntimeConnectionSettings()

    // If external authentication don't have to worry about username/password and
    // if not need to set the username and password
    const oracleDbConfig = settings.externalAuth
      ? { externalAuth: settings.externalAuth }
      : {
          user: settings.user,
          password: settings.password,
        }

    // In the case of external authentication connection string will be given
    oracleDbConfig['connectString'] = resolveConnectString(settings)

    if (settings.prefetchRowCount) {
      oracleDbConfig['prefetchRows'] = settings.prefetchRowCount
    }

    if (settings.stmtCacheSize !== undefined) {
      oracleDbConfig['stmtCacheSize'] = settings.stmtCacheSize
    }

    client.driver.fetchAsString = client.fetchAsString

    client.driver.getConnection(oracleDbConfig, function (err: Error, connection: any) {
      if (err) {
        return rejecter(err)
      }

      connection.commitAsync = function () {
        return new Promise<void>((commitResolve, commitReject) => {
          this.commit(function (err: Error) {
            if (err) {
              return commitReject(err)
            }

            commitResolve()
          })
        })
      }

      connection.rollbackAsync = function () {
        return new Promise<void>((rollbackResolve, rollbackReject) => {
          this.rollback(function (err: Error) {
            if (err) {
              return rollbackReject(err)
            }
            rollbackResolve()
          })
        })
      }

      const fetchAsync = promisify(function (sql, bindParams, options, cb) {
        options = options || {}
        options.outFormat = client.driver.OUT_FORMAT_OBJECT || client.driver.OBJECT

        if (!options.outFormat) {
          throw new Error('not found oracledb.outFormat constants')
        }

        if (options.resultSet) {
          connection.execute(sql, bindParams || [], options, function (err: Error, result: any) {
            if (err) {
              if (isConnectionError(err)) {
                connection.close().catch(function () {})
                connection.__knex__disposed = err
              }
              return cb(err)
            }

            const fetchResult = { rows: [], resultSet: result.resultSet }
            const numRows = 100

            const fetchRowsFromRS = function (connection: any, resultSet: any, numRows: any) {
              resultSet.getRows(numRows, function (err: Error, rows: any) {
                if (err) {
                  if (isConnectionError(err)) {
                    connection.close().catch(function () {})
                    connection.__knex__disposed = err
                  }

                  resultSet.close(function () {
                    return cb(err)
                  })
                } else if (rows.length === 0) {
                  return cb(null, fetchResult)
                } else if (rows.length > 0) {
                  if (rows.length === numRows) {
                    fetchResult.rows = fetchResult.rows.concat(rows)
                    fetchRowsFromRS(connection, resultSet, numRows)
                  } else {
                    fetchResult.rows = fetchResult.rows.concat(rows)
                    return cb(null, fetchResult)
                  }
                }
              })
            }

            fetchRowsFromRS(connection, result.resultSet, numRows)
          })
        } else {
          connection.execute(sql, bindParams || [], options, function (err: Error, result: any) {
            if (err) {
              // dispose the connection on connection error
              if (isConnectionError(err)) {
                connection.close().catch(function () {})
                connection.__knex__disposed = err
              }
              return cb(err)
            }

            return cb(null, result)
          })
        }
      })

      connection.executeAsync = function (sql, bindParams, options) {
        // Read all lob
        return fetchAsync(sql, bindParams, options).then(async (results: any) => {
          const closeResultSet = () => {
            return results.resultSet
              ? promisify(results.resultSet.close).call(results.resultSet)
              : Promise.resolve()
          }

          // Collect LOBs to read
          const lobs: any[] = []
          if (results.rows) {
            if (Array.isArray(results.rows)) {
              for (let i = 0; i < results.rows.length; i++) {
                // Iterate through the rows
                const row = results.rows[i]
                for (const column in row) {
                  if (row[column] instanceof stream.Readable) {
                    lobs.push({ index: i, key: column, stream: row[column] })
                  }
                }
              }
            }
          }

          try {
            for (const lob of lobs) {
              // todo should be fetchAsString/fetchAsBuffer polyfill only
              results.rows[lob.index][lob.key] = await lobProcessing(lob.stream)
            }
          } catch (e) {
            await closeResultSet().catch(() => {})

            throw e
          }

          await closeResultSet()

          return results
        })
      }
      resolver(connection)
    })
  })
  return asyncConnection
}
