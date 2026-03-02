// eslint-disable-next-line @typescript-eslint/no-var-requires
const storeModule = require('@langchain/langgraph-checkpoint-postgres/store')
const PostgresStore = storeModule.PostgresStore as {
  fromConnString(connString: string): { setup(): Promise<void> }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let store: any = null
let setupPromise: Promise<void> | null = null

export async function getStore() {
  if (store) {
    await setupPromise
    return store
  }

  const connectionString = process.env['DATABASE_URL'] ||
    'postgresql://postgres:postgres@localhost:5432/postgres'

  store = PostgresStore.fromConnString(connectionString)

  setupPromise = store.setup()
  await setupPromise

  return store
}
