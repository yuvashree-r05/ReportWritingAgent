const { toolDefinitions, executeTool } = require("./tools");

const MAX_STEPS = 8;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const parseRetryDelayMs = (errorMessage = "") => {
  const match = errorMessage.match(/try again in ([\d.]+)s/i);
  if (match) {
    return Math.ceil(parseFloat(match[1]) * 1000) + 500;
  }
  return 5000;
};

const callGroq = async (messages, retriesLeft = 2) => {
  const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${process.env.GROQ_API_KEY}`
    },
    body: JSON.stringify({
      model: "openai/gpt-oss-120b",
      max_tokens: 3000,
      reasoning_effort: "low",
      messages,
      tools: toolDefinitions,
      tool_choice: "auto"
    })
  });

  const data = await response.json();

  if (data.error?.code === "rate_limit_exceeded" && retriesLeft > 0) {
    const delay = parseRetryDelayMs(data.error.message);
    console.log(`Rate limited — waiting ${delay}ms before retrying (${retriesLeft} retries left)`);
    await sleep(delay);
    return callGroq(messages, retriesLeft - 1);
  }

  return data;
};

const runAgent = async (userId, topic, uploadedNote = "") => {
  const steps = [];
  const sourcesUsed = new Map();

  let messages = [
    {
      role: "system",
      content: `You are a research agent that writes well-structured reports.

Given a topic, your job is to:
1. First check the knowledge base (search_knowledge_base) for anything already relevant — including the user's own uploaded documents.
2. If coverage is thin, use web_search to find sources, then fetch_page to read the most promising ones.
3. Use save_source to store genuinely useful content you find, so future reports can reuse it.
4. Once you have enough information (aim for at least 2-3 solid sources), STOP calling tools and write the final report directly as your answer — no more tool calls at that point. Do not fetch more than 2 pages total before writing the report.

The report should have a short introduction, 2-4 clearly organized sections with actual findings (not vague generalities), and a brief conclusion. Do not fabricate facts — only use what you actually retrieved via your tools. Do not use markdown headers with '#', use plain text section titles instead.

${uploadedNote}`
    },
    {
      role: "user",
      content: `Write a report on: ${topic}`
    }
  ];

  let data = await callGroq(messages);
  let message = data.choices?.[0]?.message;

  if (!message) {
    console.log("Groq API Error (initial call):", JSON.stringify(data));
    throw new Error(
      data.error?.message || "Agent failed to get a response from the model"
    );
  }

  let stepCount = 0;
  let finishReason = data.choices?.[0]?.finish_reason;

  while (message?.tool_calls?.length && stepCount < MAX_STEPS) {
    messages.push(message);

    for (const call of message.tool_calls) {
      const args = JSON.parse(call.function.arguments);
      let result;

      try {
        result = await executeTool(userId, call.function.name, args);
      } catch (error) {
        result = { error: error.message };
      }

      steps.push({ tool: call.function.name, args, result });

      // Track sources surfaced by search_knowledge_base (pre-existing
      // sources retrieved via RAG)
      if (call.function.name === "search_knowledge_base" && Array.isArray(result)) {
        result.forEach((r) => sourcesUsed.set(r.id, r));
      }

      // FIX: also track sources freshly saved via save_source in THIS
      // session, so newly-gathered sources get linked to the report too,
      // not just ones retrieved from a pre-existing knowledge base.
      if (
        call.function.name === "save_source" &&
        result &&
        !result.error &&
        result.sourceIds
      ) {
        result.sourceIds.forEach((id) =>
          sourcesUsed.set(id, {
            id,
            sourceType: args.sourceType,
            origin: args.origin,
            topic: args.topic
          })
        );
      }

      messages.push({
        role: "tool",
        tool_call_id: call.id,
        content: JSON.stringify(result)
      });
    }

    data = await callGroq(messages);
    message = data.choices?.[0]?.message;
    finishReason = data.choices?.[0]?.finish_reason;

    if (!message) {
      console.log(
        `Groq API returned no message at step ${stepCount + 1}:`,
        JSON.stringify(data)
      );
      break;
    }

    stepCount++;
  }

  if (!message?.content) {
    console.log(
      `Agent finished with no content. finish_reason: "${finishReason}". Raw last message:`,
      JSON.stringify(message)
    );
  }

  if (stepCount >= MAX_STEPS) {
    console.log(`Agent hit MAX_STEPS (${MAX_STEPS}) for topic: "${topic}"`);
  }

  const report = message?.content || "The agent was unable to generate a report.";

  return {
    report,
    steps,
    sourcesUsed: Array.from(sourcesUsed.values())
  };
};

module.exports = { runAgent };