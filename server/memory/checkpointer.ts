import { PostgresSaver } from '@langchain/langgraph-checkpoint-postgres'

let checkpointer: PostgresSaver | null = null
let setupPromise: Promise<void> | null = null

export async function getCheckpointer(): Promise<PostgresSaver> {
  if (checkpointer) {
    await setupPromise
    return checkpointer
  }

  const connectionString = process.env['DATABASE_URL'] ||
    'postgresql://postgres:postgres@localhost:5432/postgres'

  checkpointer = PostgresSaver.fromConnString(connectionString)

  setupPromise = checkpointer.setup()
  await setupPromise

  return checkpointer
}
