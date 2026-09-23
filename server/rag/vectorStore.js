const { Pinecone } = require("@pinecone-database/pinecone");

const pc = new Pinecone({ apiKey: process.env.PINECONE_API_KEY });

const index = pc.index(process.env.PINECONE_INDEX_NAME, process.env.PINECONE_HOST);
const namespace = index.namespace("default");

const TEXT_FIELD = process.env.PINECONE_TEXT_FIELD || "text";

/**
 * Store one or more chunks in Pinecone. Pinecone embeds the text itself.
 *
 * FIX: the installed @pinecone-database/pinecone client expects an object
 * of the shape { records: [...] } — not a raw array — and each record's
 * ID field is "id", not "_id". This matches the package's own npm/GitHub
 * README example (as opposed to some of Pinecone's website guide pages,
 * which show a slightly different, namespace-first calling style for a
 * different SDK version). This was the actual cause of
 * "options.records is not iterable".
 */
const upsertChunks = async (chunks) => {
  const records = chunks.map((chunk) => ({
    id: chunk.id,
    [TEXT_FIELD]: chunk.text,
    sourceType: chunk.sourceType,
    origin: chunk.origin,
    topic: chunk.topic || ""
  }));

  await namespace.upsertRecords({ records });
};

/**
 * Semantic search over everything stored so far.
 */
const searchKnowledgeBase = async (queryText, topK = 5) => {
  const results = await namespace.searchRecords({
    query: {
      inputs: { text: queryText },
      topK
    },
    fields: [TEXT_FIELD, "sourceType", "origin", "topic"]
  });

  return (results.result?.hits || []).map((hit) => ({
    id: hit._id,
    score: hit._score,
    text: hit.fields?.[TEXT_FIELD],
    sourceType: hit.fields?.sourceType,
    origin: hit.fields?.origin,
    topic: hit.fields?.topic
  }));
};

module.exports = { upsertChunks, searchKnowledgeBase };