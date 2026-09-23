const axios = require("axios");
const cheerio = require("cheerio");

const Source = require("../models/Source");
const { upsertChunks, searchKnowledgeBase } = require("../rag/vectorStore");
const { chunkText } = require("../rag/parseDocument");

const toolDefinitions = [
  {
    type: "function",
    function: {
      name: "web_search",
      description:
        "Search the web for information on a topic. Returns a list of results with titles, URLs, and short snippets.",
      parameters: {
        type: "object",
        properties: {
          query: { type: "string", description: "The search query" }
        },
        required: ["query"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "fetch_page",
      description:
        "Fetch and read the full text content of a specific web page, given its URL. Use this after web_search to actually read a promising result.",
      parameters: {
        type: "object",
        properties: {
          url: { type: "string", description: "The URL to fetch" }
        },
        required: ["url"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "search_knowledge_base",
      description:
        "Semantically search previously saved sources — including the user's own uploaded documents and any web sources saved from past reports. Use this BEFORE web searching, to check if relevant information is already available.",
      parameters: {
        type: "object",
        properties: {
          query: { type: "string", description: "What to search for" }
        },
        required: ["query"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "save_source",
      description:
        "Save a useful piece of content to the knowledge base for this and future reports, so it can be retrieved again later via search_knowledge_base.",
      parameters: {
        type: "object",
        properties: {
          content: { type: "string", description: "The text content to save" },
          sourceType: {
            type: "string",
            enum: ["web", "upload"],
            description: "Where this content came from"
          },
          origin: {
            type: "string",
            description: "The URL (if web) or filename (if upload) this came from"
          },
          topic: {
            type: "string",
            description: "The report topic this source is relevant to"
          }
        },
        required: ["content", "sourceType", "origin"]
      }
    }
  }
];

const runWebSearch = async (query) => {
  const response = await axios.post("https://api.tavily.com/search", {
    api_key: process.env.TAVILY_API_KEY,
    query,
    max_results: 4 // trimmed from 5 — fewer, more relevant results = fewer tokens
  });

  return response.data.results.map((r) => ({
    title: r.title,
    url: r.url,
    // Trim snippet length too — Tavily snippets can be long
    snippet: r.content.slice(0, 500)
  }));
};

const runFetchPage = async (url) => {
  const response = await axios.get(url, {
    timeout: 10000,
    headers: { "User-Agent": "Mozilla/5.0 (ReportWritingAgent)" }
  });

  const $ = cheerio.load(response.data);
  $("script, style, nav, footer, header, aside").remove();

  const text = $("body").text().replace(/\s+/g, " ").trim();

  // Reduced from 6000 — this was the single biggest token cost per call.
  // 2500 chars (~600-700 tokens) still gives the model plenty to work with
  // per page, while leaving much more headroom in the rate limit.
  return text.slice(0, 2500);
};

const runSearchKnowledgeBase = async (query) => {
  const results = await searchKnowledgeBase(query, 5);
  return results;
};

const runSaveSource = async (userId, { content, sourceType, origin, topic }) => {
  // Skip saving if we already have something saved from this exact
  // origin (URL/filename) for this topic — prevents the knowledge base
  // from accumulating multiple, differently-worded summaries of the same
  // source across separate report runs.
  const existing = await Source.findOne({ userId, origin, topic });
  if (existing) {
    return {
      saved: 0,
      origin,
      note: "Already have a source from this origin for this topic — skipped duplicate"
    };
  }

  const chunks = chunkText(content);
  const savedChunks = [];

  for (const chunk of chunks) {
    const sourceDoc = await Source.create({
      userId,
      sourceType,
      origin,
      content: chunk,
      topic
    });

    savedChunks.push({
      id: sourceDoc._id.toString(),
      text: chunk,
      sourceType,
      origin,
      topic
    });
  }

  await upsertChunks(savedChunks);

  return {
    saved: savedChunks.length,
    origin,
    sourceIds: savedChunks.map((c) => c.id)
  };
};

const executeTool = async (userId, name, args) => {
  switch (name) {
    case "web_search":
      return runWebSearch(args.query);
    case "fetch_page":
      return runFetchPage(args.url);
    case "search_knowledge_base":
      return runSearchKnowledgeBase(args.query);
    case "save_source":
      return runSaveSource(userId, args);
    default:
      return { error: `Unknown tool: ${name}` };
  }
};

module.exports = { toolDefinitions, executeTool };