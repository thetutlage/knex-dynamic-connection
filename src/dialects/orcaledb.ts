/*
* knex-dynamic-connection
*
* (c) Harminder Virk <virk@adonisjs.com>
*
* For the full copyright and license information, please view the LICENSE
* file that was distributed with this source code.
*/

import stream from 'stream'
import Bluebird from 'bluebird'
import { isConnectionError } from 'knex/lib/dialects/oracledb/utils'

/**
 * Copied from the source code of knex
 */
/* eslint no-shadow: "off" */
function readStream (stream, cb): void {
  const oracledb = require('oracledb')
  let data: any = ''

  if (stream.iLob.type === oracledb.CLOB) {
    stream.setEncoding('utf-8')
  } else {
    data = Buffer.alloc(0)
  }

  stream.on('error', (err) => {
    cb(err)
  })

  stream.on('data', (chunk) => {
    if (stream.iLob.type === oracledb.CLOB) {
      data += chunk
    } else {
      data = Buffer.concat([data, chunk])
    }
  })

  stream.on('end', () => {
    cb(null, data)
  })
}

/**
 * Copy of `acquireRawConnection` from knex codebase, but instead relies
 * on `getRuntimeConnectionSettings` vs `connectionSettings`
 */
export function acquireRawConnection (): Promise<any> {
  const client = this

  const asyncConnection = new Bluebird((resolver, rejecter) => {
    const setting = this.getRuntimeConnectionSettings()

    // If external authentication dont have to worry about username/password and
    // if not need to set the username and password
    const oracleDbConfig = setting.externalAuth ? {
      externalAuth: setting.externalAuth,
    } : {
      user: setting.user,
      password: setting.password,
    }

    // In the case of external authentication connection string will be given
    oracleDbConfig['connectString'] = setting.connectString || setting.host + '/' + setting.database

    if (setting.prefetchRowCount) {
      oracleDbConfig['prefetchRows'] = setting.prefetchRowCount
    }

    if (setting.stmtCacheSize !== undefined) {
      oracleDbConfig['stmtCacheSize'] = setting.stmtCacheSize
    }

    client.driver.fetchAsString = client.fetchAsString

    client.driver.getConnection(oracleDbConfig, (err: Error, connection: any) => {
      if (err) {
        return rejecter(err)
      }

      connection.commitAsync = function commitAsync (): Promise<any> {
        return new Bluebird((commitResolve, commitReject) => {
          if (connection.isTransaction) {
            return commitResolve()
          }
          this.commit((err: Error) => {
            if (err) {
              return commitReject(err)
            }
            commitResolve()
          })
        })
      }

      connection.rollbackAsync = function rollbackAsync (): Promise<any> {
        return new Bluebird((rollbackResolve, rollbackReject) => {
          this.rollback((err: Error) => {
            if (err) {
              return rollbackReject(err)
            }
            rollbackResolve()
          })
        })
      }

      const fetchAsync = function fetchAsync (sql, bindParams, options, cb): any {
        options = options || {}
        options.outFormat = client.driver.OBJECT

        if (options.resultSet) {
          connection.execute(sql, bindParams || [], options, (err, result) => {
            if (err) {
              if (isConnectionError(err)) {
                connection.close().catch(() => {})
                connection.__knex__disposed = err
              }
              return cb(err)
            }
            const fetchResult = { rows: [], resultSet: result.resultSet }
            const numRows = 100

            const fetchRowsFromRS = function fetchRowsFromRS (connection, resultSet, numRows): any {
              resultSet.getRows(numRows, (err, rows) => {
                if (err) {
                  if (isConnectionError(err)) {
                    connection.close().catch((_err) => {})
                    connection.__knex__disposed = err
                  }
                  resultSet.close(() => {
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
          connection.execute(sql, bindParams || [], options, cb)
        }
      }

      connection.executeAsync = function executeAsync (sql, bindParams, options): any {
        // Read all lob
        return new Bluebird((resultResolve, resultReject) => {
          fetchAsync(sql, bindParams, options, (err, results) => {
            if (err) {
              return resultReject(err)
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

            Bluebird.each(lobs, (lob) => {
              return new Bluebird((lobResolve, lobReject) => {
                readStream(lob.stream, (err, d) => {
                  if (err) {
                    if (results.resultSet) {
                      results.resultSet.close(() => {
                        return lobReject(err)
                      })
                    }
                    return lobReject(err)
                  }
                  results.rows[lob.index][lob.key] = d
                  lobResolve()
                })
              })
            }).then(
              function resolve () {
                if (results.resultSet) {
                  results.resultSet.close((err) => {
                    if (err) {
                      return resultReject(err)
                    }
                    return resultResolve(results)
                  })
                }
                resultResolve(results)
              },
              function reject (err) {
                resultReject(err)
              },
            )
          })
        })
      }
      resolver(connection)
    })
  })
  return asyncConnection
}
