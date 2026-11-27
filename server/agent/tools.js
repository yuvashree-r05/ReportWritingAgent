
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
        "Search the web for information. Returns titles, URLs and snippets. Use before fetching pages.",
      parameters: {
        type: "object",
        properties: {
          query: { type: "string", description: "Search query" }
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
        "Fetch and read a web page. Returns its title, URL and content. Successfully fetched pages are automatically saved to the user's knowledge base.",
      parameters: {
        type: "object",
        properties: {
          url: { type: "string", description: "URL of the page to fetch" }
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
        "Search previously saved web sources and uploaded documents. Use before web searching.",
      parameters: {
        type: "object",
        properties: {
          query: { type: "string", description: "Search query" }
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
        "Save useful content to the knowledge base. Use for content that has not already been saved.",
      parameters: {
        type: "object",
        properties: {
          content: { type: "string" },
          sourceType: {
            type: "string",
            enum: ["web", "upload"]
          },
          origin: { type: "string" },
          topic: { type: "string" },
          title: { type: "string" }
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
    max_results: 4
  });

  return (response.data.results || []).map((result) => ({
    title: result.title,
    url: result.url,
    snippet: (result.content || "").slice(0, 500)
  }));
};

const runSaveSource = async (
  userId,
  { content, sourceType, origin, topic = "", title = "" }
) => {
  if (!content || !origin) {
    throw new Error("Source content and origin are required");
  }

  const existing = await Source.findOne({
    userId,
    origin,
    topic,
    sourceType
  });

  if (existing) {
    return {
      saved: 0,
      sourceIds: [existing._id.toString()],
      title: existing.title || title,
      origin,
      note: "Source already exists"
    };
  }

  const chunks = chunkText(content);

  if (!chunks.length) {
    throw new Error("No readable content found to save");
  }

  const savedChunks = [];

  for (const chunk of chunks) {
    const sourceDoc = await Source.create({
      userId,
      sourceType,
      title,
      origin,
      content: chunk,
      topic
    });

    savedChunks.push({
      id: sourceDoc._id.toString(),
      text: chunk,
      sourceType,
      title,
      origin,
      topic
    });
  }

  await upsertChunks(savedChunks);

  return {
    saved: savedChunks.length,
    sourceIds: savedChunks.map((chunk) => chunk.id),
    title,
    origin
  };
};

const runFetchPage = async (userId, url, topic = "") => {
  const response = await axios.get(url, {
    timeout: 15000,
    headers: {
      "User-Agent": "Mozilla/5.0 (ReportWritingAgent)"
    }
  });

  const $ = cheerio.load(response.data);

  const title = $("title").first().text().trim() || url;

  $("script, style, nav, footer, header, aside, noscript").remove();

  const content = $("body")
    .text()
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 12000);

  if (!content) {
    throw new Error("Could not extract readable page content");
  }

  const saved = await runSaveSource(userId, {
    content,
    sourceType: "web",
    origin: url,
    topic,
    title
  });

  return {
    title,
    url,
    content,
    savedSourceIds: saved.sourceIds,
    saved: saved.saved
  };
};

const runSearchKnowledgeBase = async (query) => {
  return await searchKnowledgeBase(query, 5);
};

const executeTool = async (userId, name, args, context = {}) => {
  switch (name) {
    case "web_search":
      return runWebSearch(args.query);

    case "fetch_page":
      return runFetchPage(userId, args.url, context.topic || "");

    case "search_knowledge_base":
      return runSearchKnowledgeBase(args.query);

    case "save_source":
      return runSaveSource(userId, args);

    default:
      return { error: `Unknown tool: ${name}` };
  }
};

module.exports = {
  toolDefinitions,
  executeTool
};
