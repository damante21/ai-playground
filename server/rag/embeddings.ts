import { OpenAIEmbeddings } from '@langchain/openai'

let embeddingsInstance: OpenAIEmbeddings | null = null

export function getEmbeddings(): OpenAIEmbeddings {
  if (!embeddingsInstance) {
    embeddingsInstance = new OpenAIEmbeddings({
      model: 'text-embedding-3-small',
      dimensions: 1536,
    })
  }
  return embeddingsInstance
}

export async function embedText(text: string): Promise<number[]> {
  const embeddings = getEmbeddings()
  return embeddings.embedQuery(text)
}

export async function embedTexts(texts: string[]): Promise<number[][]> {
  const embeddings = getEmbeddings()
  return embeddings.embedDocuments(texts)
}
