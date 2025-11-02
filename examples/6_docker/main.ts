import { Slack, OpenAI } from "floww";
import { generateText, stepCountIs } from "floww/ai";
import { z } from "zod";

const slack = new Slack();

const openai = new OpenAI();

const systemPrompt = `
You are AskEngBot, the assistant for TechWolf's #ask-engineering Slack channel.
Your goal is to automatically answer new questions by searching and summarizing past Slack discussions.

When a question is posted:

Search #ask-engineering for similar past questions using regex patterns.
You can do multiple queries. Use broadly matching regex, with wildcards to make sure you get the right results.

Summarize the most relevant answers clearly and concisely.

If no clear match exists, offer your best informed starting point.

Style:

Write like a peer engineer: short, factual, and helpful.

Include quotes or links from previous threads when useful.

If uncertain, explain what's known and suggest who might confirm.

Don't:

Guess or invent answers.

Repeat long thread histories — summarize them.

Goal:
Every new question should get an immediate, accurate, and context-aware answer based on past Slack knowledge.
`;

async function searchChannelHistory(
  channelId: string,
  searchPattern: string,
  resultLimit: number = 10
) {
  console.log(`Searching ask-engineering for ${searchPattern}`);
  const result = await slack.actions.conversationHistory({
    channelId,
    limit: 200,
  });
  const messages = result.messages || [];

  const regex = new RegExp(searchPattern, "i");
  const filteredMessages = messages.filter((msg: any) => {
    return msg.text && regex.test(msg.text);
  });

  return {
    messages: filteredMessages.slice(0, resultLimit),
    total_messages_fetched: messages.length,
    matching_messages_count: filteredMessages.length,
    returned_count: Math.min(filteredMessages.length, resultLimit),
  };
}

async function answerQuestion(question: string) {
  const result = await generateText({
    model: openai.models.gpt5,
    system: systemPrompt,
    prompt: `Question: ${question}`,
    tools: {
      searchChannelHistory: {
        description:
          "Search the channel's message history using a regex pattern. Fetches the most recent 200 messages and returns the 10 most recent matches.",
        inputSchema: z.object({
          searchPattern: z
            .string()
            .describe(
              "Regex pattern to search for in message content (case-insensitive)"
            ),
        }),
        execute: async ({ searchPattern }) => {
          return await searchChannelHistory("C092U7SA7RA", searchPattern);
        },
      },
    },
    stopWhen: stepCountIs(20),
  });

  return result.text;
}

slack.triggers.onMessage({
  channelId: "C09PT6F7NMR",
  handler: async (ctx, event) => {
    const message = event.body.event;

    console.log(
      `Received message from ${message.user} in channel ${message.channel}`
    );
    console.log(`Message text: ${message.text}`);

    const response = await answerQuestion(message.text);

    // Send a reply in the same channel
    await slack.actions.sendMessage({
      channel: message.channel,
      text: response,
      // Reply in a thread to keep conversations organized
      thread_ts: message.ts,
    });
  },
});
