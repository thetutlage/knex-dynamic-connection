/*
 * knex-dynamic-connection
 *
 * (c) Harminder Virk <virk@adonisjs.com>
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

const debug = require('debug')('knex:patched:mssql')

function isNil(value: any): boolean {
  return value !== undefined && value !== null
}

/**
 * Copy of https://github.com/knex/knex/blob/3718d647e452e3a7659ad3310a56e862f64c17be/lib/dialects/mssql/index.js#L32, but accepts the settings as an argument. I wish, they did the same
 * thing too.
 *
 * If you ever see the KNEX version using a `this` property inside this method, then
 * please report it to us. Right now, this method is pure.
 * Also, ignore "this.connectionSettings"
 */
function generateConnection(settings: any) {
  settings.options = settings.options || {}

  /** @type {import('tedious').ConnectionConfig} */
  const cfg: any = {
    authentication: {
      type: settings.type || 'default',
      options: {
        userName: settings.userName || settings.user,
        password: settings.password,
        domain: settings.domain,
        token: settings.token,
        clientId: settings.clientId,
        clientSecret: settings.clientSecret,
        tenantId: settings.tenantId,
        msiEndpoint: settings.msiEndpoint,
      },
    },
    server: settings.server || settings.host,
    options: {
      database: settings.database,
      encrypt: settings.encrypt || false,
      port: settings.port || 1433,
      connectTimeout: settings.connectionTimeout || settings.timeout || 15000,
      requestTimeout: !isNil(settings.requestTimeout) ? settings.requestTimeout : 15000,
      rowCollectionOnDone: false,
      rowCollectionOnRequestCompletion: false,
      useColumnNames: false,
      tdsVersion: settings.options.tdsVersion || '7_4',
      appName: settings.options.appName || 'knex',
      trustServerCertificate: false,
      ...settings.options,
    },
  }

  // tedious always connect via tcp when port is specified
  if (cfg.options.instanceName) {
    delete cfg.options.port
  }

  if (isNaN(cfg.options.requestTimeout)) {
    cfg.options.requestTimeout = 15000
  }

  if (cfg.options.requestTimeout === Infinity) {
    cfg.options.requestTimeout = 0
  }

  if (cfg.options.requestTimeout < 0) {
    cfg.options.requestTimeout = 0
  }

  if (settings.debug) {
    cfg.options.debug = {
      packet: true,
      token: true,
      data: true,
      payload: true,
    }
  }

  return cfg
}

/**
 * Copy of `acquireRawConnection` from knex codebase, but instead relies
 * on `getRuntimeConnectionSettings` vs `connectionSettings`
 */
export function acquireRawConnection(): Promise<any> {
  return new Promise((resolver, rejecter) => {
    debug('connection::connection new connection requested')

    const Driver = this._driver()
    const settings = Object.assign({}, generateConnection(this.getRuntimeConnectionSettings()))

    const connection = new Driver.Connection(settings)

    connection.connect((err: Error) => {
      if (err) {
        debug('connection::connect error: %s', err.message)
        return rejecter(err)
      }

      debug('connection::connect connected to server')

      connection.connected = true
      connection.on('error', (e: Error) => {
        debug('connection::error message=%s', e.message)
        connection.__knex__disposed = e
        connection.connected = false
      })

      connection.once('end', () => {
        connection.connected = false
        connection.__knex__disposed = 'Connection to server was terminated.'
        debug('connection::end connection ended.')
      })

      return resolver(connection)
    })
  })
}
