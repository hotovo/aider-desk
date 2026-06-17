/**
 * E2E test for the GitHub Copilot extension.
 * Requires the Copilot CLI to be installed and authenticated.
 * Run: node e2e-test.mjs
 */

import { CopilotClient, defineTool, ToolSet } from '@github/copilot-sdk';

const PASS = '\x1b[32m✓ PASS\x1b[0m';
const FAIL = '\x1b[31m✗ FAIL\x1b[0m';
const INFO = '\x1b[36mℹ\x1b[0m';

let passed = 0;
let failed = 0;

const assert = (condition, message) => {
  if (condition) {
    console.log(`${PASS} ${message}`);
    passed++;
  } else {
    console.log(`${FAIL} ${message}`);
    failed++;
  }
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function collectEvents(session, { signal } = {}) {
  const events = [];
  return new Promise((resolve) => {
    session.on((event) => {
      events.push(event);
      if (event.type === 'session.idle' || event.type === 'session.error') resolve(events);
    });
    if (signal) signal.addEventListener('abort', () => resolve(events), { once: true });
  });
}

async function main() {
  console.log(`\n${INFO} Starting CopilotClient...\n`);

  const client = new CopilotClient({ useLoggedInUser: true });
  await client.start();
  console.log(`${INFO} Client started\n`);

  // ── Test 1: listModels ──
  console.log('── Test 1: listModels ──');
  const models = await client.listModels();
  assert(models.length > 0, `listModels returns ${models.length} models`);

  const realModels = models.filter((m) => m.id !== 'auto');
  assert(realModels.length > 0, `Found ${realModels.length} usable models (excluding 'auto')`);

  for (const m of realModels) {
    console.log(`  ${INFO} ${m.id} — ${m.name} (ctx: ${m.capabilities?.limits?.max_context_window_tokens}, tools: ${m.capabilities?.supports?.tool_calls})`);
  }

  const testModel = realModels[0];
  console.log(`\n${INFO} Using model: ${testModel.id}\n`);

  // ── Test 2: Non-streaming session (sendAndWait) ──
  console.log('── Test 2: Non-streaming session ──');
  {
    const session = await client.createSession({
      model: testModel.id,
      streaming: false,
    });

    assert(!!session, 'Session created');

    const result = await session.sendAndWait({ prompt: 'Say exactly "hello world" and nothing else.' }, 60_000);
    const responseText = result?.data?.content ?? '';

    assert(responseText.length > 0, `Non-streaming response received (${responseText.length} chars)`);
    console.log(`  ${INFO} Response: "${responseText.slice(0, 100)}..."`);

    await session.disconnect();
  }

  // ── Test 3: Streaming session ──
  console.log('\n── Test 3: Streaming session ──');
  {
    const session = await client.createSession({
      model: testModel.id,
      streaming: true,
    });

    assert(!!session, 'Streaming session created');

    const textDeltas = [];
    let streamDone = false;
    const donePromise = new Promise((resolve) => {
      session.on((event) => {
        if (event.type === 'assistant.message_delta' && event.data?.deltaContent) {
          textDeltas.push(event.data.deltaContent);
        }
        if (event.type === 'session.idle' || event.type === 'session.error') {
          streamDone = true;
          resolve();
        }
      });
    });

    await session.send({ prompt: 'Say exactly "streaming works" and nothing else.' });
    await Promise.race([donePromise, sleep(60_000)]);

    assert(textDeltas.length > 0, `Streaming text received (${[...textDeltas].length} chars)`);
    console.log(`  ${INFO} Response: "${textDeltas.join('').slice(0, 100)}..."`);

    await session.disconnect();
  }

  // ── Test 4: Declaration-only tools + assistant.message tool requests ──
  console.log('\n── Test 4: Declaration-only tools (no handler) + assistant.message ──');
  {
    // Declare tool WITHOUT handler — CLI presents it to the model but doesn't execute
    const echoTool = defineTool('echo_test', {
      description: 'Echo back the provided message',
      parameters: {
        type: 'object',
        properties: {
          message: { type: 'string', description: 'Message to echo back' },
        },
        required: ['message'],
      },
    });

    const session = await client.createSession({
      model: testModel.id,
      streaming: true,
      tools: [echoTool],
      availableTools: new ToolSet().addCustom('*'),
    });

    assert(!!session, 'Declaration-only tool session created with availableTools restriction');

    const events = [];
    const donePromise = new Promise((resolve) => {
      session.on((event) => {
        events.push(event);
        if (event.type === 'session.idle' || event.type === 'session.error') resolve();
      });
    });

    await session.send({ prompt: 'Use the echo_test tool with the message "hi there".' });
    await Promise.race([donePromise, sleep(60_000)]);

    // With declaration-only tools, the CLI should:
    // 1. Emit assistant.message with toolRequests (model wants to call the tool)
    // 2. NOT emit tool.execution_start/complete (no handler to execute)
    // 3. The CLI session may enter a "pending tool" state, OR it may reconnect

    const assistantMessages = events.filter((e) => e.type === 'assistant.message');
    const toolStarts = events.filter((e) => e.type === 'tool.execution_start');
    const toolCompletes = events.filter((e) => e.type === 'tool.execution_complete');

    assert(assistantMessages.length > 0, `assistant.message event received (${assistantMessages.length})`);

    const toolRequests = assistantMessages.flatMap((e) => e.data?.toolRequests ?? []);
    console.log(`  ${INFO} Tool requests from assistant.message: ${JSON.stringify(toolRequests.map((t) => ({ name: t.name, callId: t.toolCallId })))}`);
    console.log(`  ${INFO} tool.execution_start events: ${toolStarts.length}`);
    console.log(`  ${INFO} tool.execution_complete events: ${toolCompletes.length}`);

    assert(toolRequests.length > 0, `Model requested tool calls via assistant.message (${toolRequests.length} requests)`);

    const echoRequest = toolRequests.find((t) => t.name === 'echo_test');
    assert(!!echoRequest, 'Model specifically requested echo_test tool');
    assert(!!echoRequest?.toolCallId, 'Tool request has toolCallId');
    assert(!!echoRequest?.arguments, 'Tool request has arguments');

    if (echoRequest?.arguments) {
      console.log(`  ${INFO} echo_test args: ${JSON.stringify(echoRequest.arguments)}`);
    }

    await session.disconnect();
  }

  // ── Test 5: System message ──
  console.log('\n── Test 5: System message ──');
  {
    const session = await client.createSession({
      model: testModel.id,
      streaming: false,
      systemMessage: { mode: 'replace', content: 'You must always respond with exactly "SYSTEM_OK". No other text.' },
    });

    const result = await session.sendAndWait({ prompt: 'Say something.' }, 60_000);
    const responseText = (result?.data?.content ?? '').trim();

    assert(
      responseText.includes('SYSTEM_OK') || responseText.toUpperCase().includes('SYSTEM_OK'),
      `System message respected (response: "${responseText.slice(0, 80)}")`,
    );

    await session.disconnect();
  }

  // ── Test 6: Multiturn conversation ──
  console.log('\n── Test 6: Multiturn conversation ──');
  {
    const session = await client.createSession({
      model: testModel.id,
      streaming: true,
      availableTools: new ToolSet().addCustom('*'),
    });

    assert(!!session, 'Multiturn session created');

    // Turn 1
    const turn1Events = [];
    const turn1Done = new Promise((resolve) => {
      session.on((event) => {
        turn1Events.push(event);
        if (event.type === 'session.idle') resolve();
      });
    });
    await session.send({ prompt: 'Remember that my favorite color is blue. Say "got it".' });
    await Promise.race([turn1Done, sleep(60_000)]);

    const turn1Text = turn1Events
      .filter((e) => e.type === 'assistant.message_delta')
      .map((e) => e.data?.deltaContent ?? '')
      .join('');
    assert(turn1Text.length > 0, `Turn 1 response received (${turn1Text.length} chars)`);
    console.log(`  ${INFO} Turn 1: "${turn1Text.slice(0, 80)}..."`);

    // Turn 2
    const turn2Events = [];
    const turn2Done = new Promise((resolve) => {
      session.on((event) => {
        turn2Events.push(event);
        if (event.type === 'session.idle') resolve();
      });
    });
    await session.send({ prompt: 'What is my favorite color? Answer in one word.' });
    await Promise.race([turn2Done, sleep(60_000)]);

    const turn2Text = turn2Events
      .filter((e) => e.type === 'assistant.message_delta')
      .map((e) => e.data?.deltaContent ?? '')
      .join('');
    assert(turn2Text.length > 0, `Turn 2 response received (${turn2Text.length} chars)`);
    assert(
      turn2Text.toLowerCase().includes('blue'),
      `Multiturn context preserved — model remembered "blue" (response: "${turn2Text.slice(0, 80)}")`,
    );
    console.log(`  ${INFO} Turn 2: "${turn2Text.slice(0, 80)}..."`);

    await session.disconnect();
  }

  // ── Test 7: Session abort ──
  console.log('\n── Test 7: Session abort ──');
  {
    const session = await client.createSession({
      model: testModel.id,
      streaming: true,
    });

    session.send({ prompt: 'Write a very long essay about the history of computing.' });
    await sleep(2000);
    session.abort();
    assert(true, 'Session.abort() did not throw');

    await session.disconnect();
  }

  await client.stop();

  // ── Summary ──
  console.log(`\n${'═'.repeat(50)}`);
  console.log(`  Results: ${passed} passed, ${failed} failed`);
  console.log(`${'═'.repeat(50)}\n`);

  process.exit(failed > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error('\nFatal error:', err);
  process.exit(1);
});
