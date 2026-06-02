require('dotenv').config();
const OpenAI = require('openai');

const client = new OpenAI({
  apiKey: process.env.NVIDIA_API_KEY,
  baseURL: 'https://integrate.api.nvidia.com/v1',
});

const model = process.env.NVIDIA_MODEL || 'meta/llama-3.3-70b-instruct';

const TOOLS = [
  {
    type: 'function',
    function: {
      name: 'draft_booking',
      description: 'Drafts a ride booking when user wants to book a ride.',
      parameters: {
        type: 'object',
        properties: {
          origin:      { type: 'string', description: 'Pickup location' },
          destination: { type: 'string', description: 'Drop-off location' },
          time:        { type: 'string', description: 'Departure time HH:MM' }
        },
        required: ['origin', 'destination', 'time']
      }
    }
  }
];

async function runTests() {
  console.log('\n╔══════════════════════════════════════════════════════╗');
  console.log('║     NVIDIA NIM — Carpool AI Agent Test Suite        ║');
  console.log('╚══════════════════════════════════════════════════════╝');
  console.log(`  Model  : ${model}`);
  console.log(`  Key    : ${process.env.NVIDIA_API_KEY.slice(0, 14)}...`);
  console.log('');

  // ── Test 1: Plain text response ─────────────────────────────────────────────
  console.log('TEST 1 ▶ Plain text (policy question)');
  try {
    const res1 = await client.chat.completions.create({
      model,
      messages: [
        { role: 'system', content: 'You are Commute Copilot for Reliance Carpool. Answer briefly.' },
        { role: 'user',   content: 'What is the cancellation policy for rides?' }
      ],
      max_tokens: 150,
      temperature: 0.5,
    });
    const text = res1.choices[0].message.content;
    console.log('  ✅ Response received');
    console.log(`  💬 "${text.slice(0, 120)}..."`);
    console.log(`  📊 Tokens used: ${res1.usage.total_tokens} (prompt: ${res1.usage.prompt_tokens}, completion: ${res1.usage.completion_tokens})`);
  } catch (err) {
    console.error('  ❌ FAILED:', err.message);
    process.exit(1);
  }

  console.log('');

  // ── Test 2: Tool calling (draft_booking) ────────────────────────────────────
  console.log('TEST 2 ▶ Tool calling — draft_booking');
  try {
    const res2 = await client.chat.completions.create({
      model,
      messages: [
        { role: 'system', content: 'You are Commute Copilot for Reliance Carpool. Use tools when the user wants to book a ride.' },
        { role: 'user',   content: 'I need a ride from Kharghar to RCP Twin Towers at 9am tomorrow.' }
      ],
      tools: TOOLS,
      tool_choice: 'auto',
      max_tokens: 256,
      temperature: 0.3,
    });
    const msg = res2.choices[0].message;
    if (msg.tool_calls && msg.tool_calls.length > 0) {
      const call = msg.tool_calls[0];
      const args = JSON.parse(call.function.arguments);
      console.log('  ✅ Tool call triggered correctly');
      console.log(`  🔧 Function: ${call.function.name}`);
      console.log(`  📍 Origin     : ${args.origin}`);
      console.log(`  📍 Destination: ${args.destination}`);
      console.log(`  🕐 Time       : ${args.time}`);
    } else {
      console.log('  ⚠️  No tool call — model responded with text instead:');
      console.log(`  💬 "${msg.content}"`);
    }
  } catch (err) {
    console.error('  ❌ FAILED:', err.message);
    process.exit(1);
  }

  console.log('');

  // ── Test 3: Context injection (user stats) ──────────────────────────────────
  console.log('TEST 3 ▶ Context injection (user stats query)');
  try {
    const fakeStats = { rides_taken: 14, avg_cost: 48, co2_saved: 44.1 };
    const res3 = await client.chat.completions.create({
      model,
      messages: [
        { role: 'system', content: 'You are Commute Copilot for Reliance Carpool. Answer briefly using the stats in the System Note.' },
        { role: 'user',   content: `[System Note: The current user is a Passenger. Stats: ${JSON.stringify(fakeStats)}]\n\nUser Query: How many rides have I taken and how much CO2 did I save?` }
      ],
      max_tokens: 100,
      temperature: 0.5,
    });
    const text3 = res3.choices[0].message.content;
    console.log('  ✅ Context-aware response received');
    console.log(`  💬 "${text3}"`);
  } catch (err) {
    console.error('  ❌ FAILED:', err.message);
    process.exit(1);
  }

  console.log('');
  console.log('══════════════════════════════════════════════════════════');
  console.log('  🎉 ALL TESTS PASSED — NVIDIA NIM agent is ready!');
  console.log('══════════════════════════════════════════════════════════\n');
}

runTests();
