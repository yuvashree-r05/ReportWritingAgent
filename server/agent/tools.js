const axios = require("axios");
const cheerio = require("cheerio");

const Source = require("../models/Source");
const { upsertChunks, searchKnowledgeBase } = require("../rag/vectorStore");
const { chunkText } = require("../rag/parseDocument");

// Size limits. Smaller numbers mean less text is sent to the AI at each step.
const MAX_SEARCH_RESULTS = 3; // web results per search
const MAX_SNIPPET_LENGTH = 300; // characters of preview per web result
const MAX_PAGE_DOWNLOAD_BYTES = 1024 * 1024; // largest page we will download (1 MB)
const MAX_PAGE_TEXT_SAVED = 12000; // characters of page text we save to the database
const MAX_PAGE_TEXT_TO_AI = 1500; // characters of page text we send back to the AI
const MAX_KB_RESULTS = 3; // saved sources returned per search
const MAX_KB_TEXT_TO_AI = 600; // characters per saved source sent to the AI

const PDF_NOT_SUPPORTED = "PDF pages are not supported. Try a different source.";

// The three tools the AI is allowed to use.
const toolDefinitions = [
  {
    type: "function",
    function: {
      name: "web_search",
      description:
        "Search the web. Returns titles, URLs and short snippets. Use before fetching pages.",
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
        "Read a web page. Returns its title, URL and a short excerpt. The page is saved automatically.",
      parameters: {
        type: "object",
        properties: {
          url: { type: "string", description: "URL of the page to read" }
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
        "Search sources already saved, including uploaded documents. Use this first.",
      parameters: {
        type: "object",
        properties: {
          query: { type: "string", description: "Search query" }
        },
        required: ["query"]
      }
    }
  }
];

// Searches the web with Tavily and returns a short list of results.
const runWebSearch = async (query) => {
  const response = await axios.post(
    "https://api.tavily.com/search",
    {
      api_key: process.env.TAVILY_API_KEY,
      query,
      max_results: MAX_SEARCH_RESULTS
    },
    { timeout: 15000 }
  );

  return (response.data.results || []).slice(0, MAX_SEARCH_RESULTS).map((result) => ({
    title: result.title,
    url: result.url,
    snippet: (result.content || "").slice(0, MAX_SNIPPET_LENGTH)
  }));
};

// Saves text to the database and to the search index.
// If this page was already saved for this topic, it is not saved again.
const saveText = async (userId, { content, sourceType, origin, topic = "", title = "" }) => {
  const existing = await Source.find({ userId, origin, topic, sourceType }).sort({ createdAt: 1 });

  if (existing.length > 0) {
    return {
      sourceIds: existing.map((source) => source._id.toString())
    };
  }

  // Cut the text into smaller pieces that the search can work with.
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

  // Add the pieces to the search index.
  await upsertChunks(savedChunks);

  return {
    sourceIds: savedChunks.map((chunk) => chunk.id)
  };
};

// Downloads a web page, keeps the readable text, and saves it.
const runFetchPage = async (userId, url, topic = "") => {
  const parsedUrl = new URL(url);

  // Only normal web addresses are allowed.
  if (!["http:", "https:"].includes(parsedUrl.protocol)) {
    throw new Error("Only HTTP and HTTPS web addresses are supported");
  }

  // Skip links that clearly point to a PDF.
  if (parsedUrl.pathname.toLowerCase().endsWith(".pdf")) {
    throw new Error(PDF_NOT_SUPPORTED);
  }

  const response = await axios.get(url, {
    timeout: 15000,
    maxContentLength: MAX_PAGE_DOWNLOAD_BYTES,
    headers: {
      "User-Agent": "Mozilla/5.0 (ReportWritingAgent)"
    }
  });

  // Some PDFs have links that do not end in .pdf, so also check the file type sent by the server.
  const contentType = (response.headers["content-type"] || "").toLowerCase();

  if (contentType.includes("application/pdf")) {
    throw new Error(PDF_NOT_SUPPORTED);
  }

  const $ = cheerio.load(response.data);
  const title = $("title").first().text().trim() || url;

  // Delete menus, scripts, and other page parts that are not article text.
  $("script, style, nav, footer, header, aside, noscript").remove();

  // Get the remaining text, tidy up the spaces, and keep the first part of it.
  const fullText = $("body")
    .text()
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, MAX_PAGE_TEXT_SAVED);

  if (!fullText) {
    throw new Error("Could not read the content of this page");
  }

  // Save the full text so it can be searched later.
  const saved = await saveText(userId, {
    content: fullText,
    sourceType: "web",
    origin: url,
    topic,
    title
  });

  // Send only a short piece back to the AI, to keep its request small.
  return {
    title,
    url,
    content: fullText.slice(0, MAX_PAGE_TEXT_TO_AI),
    savedSourceIds: saved.sourceIds
  };
};

// Searches the saved sources and returns the best matches.
const runSearchKnowledgeBase = async (query) => {
  const results = await searchKnowledgeBase(query, MAX_KB_RESULTS);

  return (results || []).slice(0, MAX_KB_RESULTS).map((item) => ({
    id: item.id,
    title: item.title,
    origin: item.origin,
    sourceType: item.sourceType,
    text: (item.text || "").slice(0, MAX_KB_TEXT_TO_AI)
  }));
};

// Runs the tool the AI asked for, by its name.
const executeTool = async (userId, name, args, context = {}) => {
  switch (name) {
    case "web_search":
      return runWebSearch(args.query);

    case "fetch_page":
      return runFetchPage(userId, args.url, context.topic || "");

    case "search_knowledge_base":
      return runSearchKnowledgeBase(args.query);

    default:
      return { error: `Unknown tool: ${name}` };
  }
};

module.exports = {
  toolDefinitions,
  executeTool
};