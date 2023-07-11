# Knex Dynamic Connection

This module is meant to patch knex and add support for defining dynamic connection configuration.

[![gh-workflow-image]][gh-workflow-url] [![npm-image]][npm-url] ![](https://img.shields.io/badge/Typescript-294E80.svg?style=for-the-badge&logo=typescript)

<!-- START doctoc generated TOC please keep comment here to allow auto update -->
<!-- DON'T EDIT THIS SECTION, INSTEAD RE-RUN doctoc TO UPDATE -->
## Table of contents

- [Why you need it?](#why-you-need-it)
- [Is it reliable?](#is-it-reliable)
- [How does it actually work?](#how-does-it-actually-work)
- [Will this work in the future?](#will-this-work-in-the-future)

<!-- END doctoc generated TOC please keep comment here to allow auto update -->

## Why you need it?
Knex.js doesn't have inbuilt support for read/write connections. One can create two seperate instances of knex for read and write, but that still doesn't completely solve the problem. For example:

```js
const Knex = require('knex')

const writeConfig = {
  client: 'pg',
  connection: {
  }
}
const writer = Knex(writeConfig)

const readConfig = {
  client: 'pg',
  connection: {
  }
}
const reader = Knex(readConfig)
```

Now, if you want to use multiple servers for read operations, you cannot do that, since knex.js allows only one connection server and will pool connections within that server.

**Following is not possible**

```js
const readConfig = {
  client: 'pg',
  connection: [
    {
      host: ''
    },
    {
      host: ''
    }
  ]
}
```

With the help of this module, you can make knex create a connection using the dynamic config for every query.

```sh
npm i knex-dynamic-connection
```

```js
const Knex = require('knex')
const { patchKnex } = require('knex-dynamic-connection')

const readConfig = {
  client: 'pg',
  connection: {},
  replicas: [
    {
      host: '',
    },
    {
      host: '',
    }
  ],
}

const knex = Knex(readConfig)
let roundRobinCounter = 0

patchKnex(knex, (originalConfig) => {
  const node = roundRobinCounter++ % originalConfig.replicas.length
  return originalConfig.replicas[node]
})
```

The `patchKnex` method overwrites the `acquireRawConnection` on all the dialects and make them fetch the config from your callback vs reading it from a static source.

## Is it reliable?
Yes!

1. I have copied the code of `acquireRawConnection` from the knex codebase and have just made one line of change to read the config from a different source.
2. I have written tests for `select`, `insert`, `transactions` and `schema` methods.
3. The code is tested against `mssql`, `mysql`, `mysql2` and `pg`.
4. The connection is still managed inside the pool, so don't worry about any extra maintaince overhead.

## How does it actually work?
Knex.js makes use of [tarn.js](https://github.com/vincit/tarn.js/) for managing pool resources and everytime pool needs a connection, knexjs calls [acquireRawConnection](https://github.com/tgriesser/knex/blob/master/lib/client.js#L258) on the dialect in use.

The dialect creates a new connection to the database server, **but uses static configuration**. I have just added a patch, which will rely on your closure to return the config vs using the same static config all the time.

## Will this work in the future?
I am using Knex.js to write the ORM of https://adonisjs.com/ and will keep a close eye on the releases of Knex to make sure that I incorporate any changes made of the underlying code and keep this module upto date. If knex.js team plans to re-write the entire codebase (which is less likely to happen), then I will pitch this change to be a first class citizen.

## Can I help?
Yes, there are currently no tests for oracle. It will be great, if you can help set it up using docker

[gh-workflow-image]: https://img.shields.io/github/actions/workflow/status/thetutlage/knex-dynamic-connection/test.yml?style=for-the-badge
[gh-workflow-url]: https://github.com/thetutlage/knex-dynamic-connection/actions/workflows/test.yml "Github action"

[npm-image]: https://img.shields.io/npm/v/knex-dynamic-connection.svg?style=for-the-badge&logo=npm
[npm-url]: https://npmjs.org/package/knex-dynamic-connection "npm"
