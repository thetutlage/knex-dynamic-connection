import { Knex } from 'knex'

export declare function patchKnex(
  knex: Knex,
  configFn: (config: Knex.Config) => Knex.ConnectionConfig
): void
