
const { Pinecone } = require("@pinecone-database/pinecone");

const pc = new Pinecone({ apiKey: process.env.PINECONE_API_KEY });

const index = pc.index(
  process.env.PINECONE_INDEX_NAME,
  process.env.PINECONE_HOST
);

const namespace = index.namespace("default");

const TEXT_FIELD = process.env.PINECONE_TEXT_FIELD || "text";

// Store document chunks in Pinecone
const upsertChunks = async (chunks) => {
  const records = chunks.map((chunk) => ({
    id: chunk.id,
    [TEXT_FIELD]: chunk.text,
    sourceType: chunk.sourceType,
    origin: chunk.origin,
    title: chunk.title || "",
    topic: chunk.topic || ""
  }));

  await namespace.upsertRecords({ records });
};

// Retrieve relevant chunks from the knowledge base
const searchKnowledgeBase = async (queryText, topK = 5) => {
  const results = await namespace.searchRecords({
    query: {
      inputs: { text: queryText },
      topK
    },
    fields: [
      TEXT_FIELD,
      "sourceType",
      "origin",
      "title",
      "topic"
    ]
  });

  return (results.result?.hits || []).map((hit) => ({
    id: hit._id,
    score: hit._score,
    text: hit.fields?.[TEXT_FIELD],
    sourceType: hit.fields?.sourceType,
    origin: hit.fields?.origin,
    title: hit.fields?.title || "",
    topic: hit.fields?.topic
  }));
};

module.exports = {
  upsertChunks,
  searchKnowledgeBase
};
