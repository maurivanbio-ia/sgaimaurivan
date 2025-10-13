import OpenAI from "openai";

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

async function test() {
  const completion = await client.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [{ role: "user", content: "Olá, mundo da API OpenAI!" }],
  });
  console.log(completion.choices[0].message.content);
}

test();
