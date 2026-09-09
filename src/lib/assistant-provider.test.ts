import assert from "node:assert/strict";
import {
  coerceAssistantAction,
  createDeepSeekProvider,
  deepseekConfigured,
  localProvider,
  needsConfirmFor,
  resolveAssistantProvider,
} from "./assistant-provider";
import type { Capability } from "./assistant";

const caps: Capability[] = ["list_availability", "draft_email", "draft_reschedule"];
const ctx = {
  todayKey: "2026-09-22",
  clients: [{ id: "c2", name: "Alex" }],
  lessons: [
    {
      id: "l2",
      clientId: "c2",
      clientName: "Alex",
      startAt: "2026-09-25T19:00:00.000Z",
      status: "confirmed",
      location: "Blackmore",
    },
  ],
};

async function main() {
  const prevProvider = process.env.ASSISTANT_PROVIDER;
  const prevKey = process.env.DEEPSEEK_API_KEY;

  function restoreEnv() {
    if (prevProvider === undefined) delete process.env.ASSISTANT_PROVIDER;
    else process.env.ASSISTANT_PROVIDER = prevProvider;
    if (prevKey === undefined) delete process.env.DEEPSEEK_API_KEY;
    else process.env.DEEPSEEK_API_KEY = prevKey;
  }

  try {
    delete process.env.ASSISTANT_PROVIDER;
    assert.equal(resolveAssistantProvider().name, "local");
    process.env.ASSISTANT_PROVIDER = "local";
    assert.equal(resolveAssistantProvider().name, "local");
    process.env.ASSISTANT_PROVIDER = "deepseek";
    assert.equal(resolveAssistantProvider().name, "deepseek");

    delete process.env.DEEPSEEK_API_KEY;
    assert.equal(deepseekConfigured(), false);
    assert.equal(resolveAssistantProvider("deepseek").configured(), false);

    process.env.DEEPSEEK_API_KEY = "sk-test";
    assert.equal(deepseekConfigured(), true);
    assert.equal(resolveAssistantProvider("deepseek").configured(), true);

    const list = await localProvider.chat({
      coachId: "coach1",
      message: "Openings this week",
      capabilities: caps,
      context: ctx,
    });
    assert.equal(list.ok, true);
    if (list.ok) {
      assert.equal(list.needsConfirm, false);
      assert.equal(list.action?.type, "list_availability");
    }

    const email = await localProvider.chat({
      coachId: "coach1",
      message: "Email Alex about Tuesday",
      capabilities: caps,
      context: ctx,
    });
    assert.equal(email.ok, true);
    if (email.ok) {
      assert.equal(email.needsConfirm, true);
      assert.equal(email.action?.type, "draft_email");
    }

    assert.equal(needsConfirmFor({ type: "list_availability", dateKey: "2026-09-22", days: 1 }), false);
    assert.equal(needsConfirmFor({ type: "draft_email", lessonId: "l2", body: "Hi" }), true);
    assert.deepEqual(
      coerceAssistantAction({ type: "list_availability", dateKey: "2026-09-22", days: 7 }, caps),
      { type: "list_availability", dateKey: "2026-09-22", days: 7 },
    );
    assert.equal(coerceAssistantAction({ type: "list_availability", dateKey: "nope", days: 7 }, caps), null);
    assert.equal(coerceAssistantAction({ type: "draft_email", lessonId: "l2", body: "" }, caps), null);

    {
      const provider = createDeepSeekProvider({
        fetchFn: async () =>
          new Response("nope", { status: 500, statusText: "Internal Server Error" }),
      });
      process.env.DEEPSEEK_API_KEY = "sk-test";
      const failed = await provider.chat({
        coachId: "coach1",
        message: "Openings this week",
        capabilities: caps,
        context: ctx,
      });
      assert.equal(failed.ok, false);
      if (!failed.ok) assert.match(failed.error, /Model request failed/);
    }

    {
      const provider = createDeepSeekProvider({
        fetchFn: async () => {
          throw new Error("network down");
        },
      });
      const failed = await provider.chat({
        coachId: "coach1",
        message: "hi",
        capabilities: caps,
        context: ctx,
      });
      assert.equal(failed.ok, false);
      if (!failed.ok) assert.equal(failed.error, "Model request failed");
    }

    {
      delete process.env.DEEPSEEK_API_KEY;
      const provider = createDeepSeekProvider({
        fetchFn: async () => {
          throw new Error("should not fetch");
        },
      });
      const failed = await provider.chat({
        coachId: "coach1",
        message: "hi",
        capabilities: caps,
        context: ctx,
      });
      assert.equal(failed.ok, false);
      if (!failed.ok) assert.equal(failed.error, "Model not configured");
    }

    {
      process.env.DEEPSEEK_API_KEY = "sk-test";
      const provider = createDeepSeekProvider({
        fetchFn: async () =>
          new Response(
            JSON.stringify({
              choices: [
                {
                  message: {
                    content: JSON.stringify({
                      text: "Draft ready",
                      summary: "Email Alex",
                      action: { type: "draft_email", lessonId: "l2", body: "Hi Alex, see you then." },
                    }),
                  },
                },
              ],
            }),
            { status: 200, headers: { "Content-Type": "application/json" } },
          ),
      });
      const ok = await provider.chat({
        coachId: "coach1",
        message: "Email Alex",
        capabilities: caps,
        context: ctx,
      });
      assert.equal(ok.ok, true);
      if (ok.ok) {
        assert.equal(ok.needsConfirm, true);
        assert.equal(ok.action?.type, "draft_email");
      }
    }

    console.log("assistant-provider tests ok");
  } finally {
    restoreEnv();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
