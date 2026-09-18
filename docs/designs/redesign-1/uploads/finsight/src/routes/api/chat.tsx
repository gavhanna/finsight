import { chat, convertMessagesToModelMessages, maxIterations, toServerSentEventsResponse } from "@tanstack/ai"
import { createFileRoute } from "@tanstack/react-router"
import { createOllamaChat } from "@tanstack/ai-ollama"
import { z } from "zod"
import { db } from "@/db/index.server"
import { deriveChatContext } from "@/lib/ai-chat.page-context"
import { settings } from "@/db/schema"
import { chatContextSchema, chatScopeSchema } from "@/lib/ai-chat.types"
import { getChatSystemPrompts } from "@/server/services/ai-chat/system-prompt"
import { createFinanceTools } from "@/server/services/ai-chat/tools"

const chatRequestSchema = z.object({
  messages: z.array(z.any()),
  data: z.object({
    context: chatContextSchema.optional(),
    scope: chatScopeSchema.optional(),
  }).optional(),
  context: chatContextSchema.optional(),
  scope: chatScopeSchema.optional(),
})

export const Route = createFileRoute("/api/chat")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const parsed = chatRequestSchema.parse(await request.json())
        const referer = request.headers.get("referer")
        const refererContext = referer ? deriveContextFromReferer(referer) : undefined
        const context = parsed.data?.context ?? parsed.context ?? refererContext
        const scope = parsed.data?.scope ?? parsed.scope ?? "page"

        if (!context) {
          return new Response("Chat context is missing from the request.", { status: 400 })
        }

        const settingRows = await db.select().from(settings)
        const settingMap = Object.fromEntries(settingRows.map((row) => [row.key, row.value]))
        const ollamaUrl = settingMap["ollama_url"]
        const ollamaModel = settingMap["ollama_model"] ?? "llama3"

        if (!ollamaUrl) {
          return new Response("Ollama is not configured. Add a URL in Settings.", { status: 400 })
        }

        const abortController = new AbortController()
        request.signal.addEventListener("abort", () => abortController.abort())

        const stream = chat({
          adapter: createOllamaChat(ollamaModel, ollamaUrl),
          messages: convertMessagesToModelMessages(parsed.messages) as any,
          systemPrompts: getChatSystemPrompts(context, scope),
          tools: createFinanceTools(context, scope),
          agentLoopStrategy: maxIterations(6),
          abortController,
        })

        return toServerSentEventsResponse(stream, { abortController })
      },
    },
  },
  component: () => null,
})

function deriveContextFromReferer(referer: string) {
  try {
    const url = new URL(referer)
    const search = Object.fromEntries(url.searchParams.entries())
    return deriveChatContext(url.pathname, search)
  } catch {
    return undefined
  }
}
