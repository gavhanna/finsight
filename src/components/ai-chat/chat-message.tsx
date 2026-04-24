"use client"

import { Bot, Sparkles, User } from "lucide-react"
import { useNavigate } from "@tanstack/react-router"
import type { UIMessage } from "@tanstack/ai"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import type { ChatNavigationAction } from "@/lib/ai-chat.types"
import { cn } from "@/lib/utils"

export function ChatMessage({ message }: { message: UIMessage }) {
  const navigate = useNavigate()
  const isAssistant = message.role === "assistant"
  const rawTextParts = (message.parts ?? []).filter((part): part is Extract<UIMessage["parts"][number], { type: "text" }> =>
    part.type === "text" && typeof part.content === "string" && part.content.length > 0,
  )
  const toolParts = (message.parts ?? []).filter((part) => part.type === "tool-call")
  const actionParts = toolParts.filter((part): part is Extract<UIMessage["parts"][number], { type: "tool-call" }> & { output: ChatNavigationAction } =>
    isNavigationAction(part.output),
  )
  const statusParts = toolParts.filter(
    (part) => !isNavigationAction(part.output) && part.state !== "input-complete",
  )
  const { visibleTextParts, suppressedToolCallTextCount } = sanitizeTextParts(rawTextParts, isAssistant)

  function handleAction(action: ChatNavigationAction) {
    void navigate({
      to: action.to as never,
      params: action.params as never,
      search: action.search as never,
    })
  }

  return (
    <div className={cn("flex gap-3", !isAssistant && "justify-end")}>
      {isAssistant && (
        <div className="flex size-8 shrink-0 items-center justify-center rounded-full border bg-muted text-muted-foreground">
          <Bot className="size-4" />
        </div>
      )}
      <div className={cn("flex max-w-[85%] flex-col gap-2", !isAssistant && "items-end")}>
        <div
          className={cn(
            "rounded-2xl px-4 py-3 text-sm leading-relaxed",
            isAssistant ? "border bg-card text-foreground" : "bg-primary text-primary-foreground",
          )}
        >
          {visibleTextParts.length > 0 ? (
            visibleTextParts.map((content, index) => (
              <p key={`${message.id}-text-${index}`}>{content}</p>
            ))
          ) : suppressedToolCallTextCount > 0 ? (
            <p>I hit a formatting hiccup while gathering data. Please try that question once more.</p>
          ) : (
            <p>{isAssistant ? "Working on it..." : ""}</p>
          )}
        </div>
        {statusParts.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {statusParts.map((part, index) => (
              <Badge key={`${message.id}-tool-${index}`} variant="outline" className="gap-1">
                <Sparkles className="size-3" />
                {part.name}
                {part.state ? ` · ${part.state}` : ""}
              </Badge>
            ))}
          </div>
        )}
        {actionParts.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {actionParts.map((part, index) => (
              <Button
                key={`${message.id}-action-${index}`}
                type="button"
                size="sm"
                variant="outline"
                onClick={() => handleAction(part.output)}
                className="h-8 rounded-full"
              >
                {part.output.label}
              </Button>
            ))}
          </div>
        )}
      </div>
      {!isAssistant && (
        <div className="flex size-8 shrink-0 items-center justify-center rounded-full border bg-primary/10 text-primary">
          <User className="size-4" />
        </div>
      )}
    </div>
  )
}

function sanitizeTextParts(
  textParts: Array<Extract<UIMessage["parts"][number], { type: "text" }>>,
  isAssistant: boolean,
) {
  if (!isAssistant) {
    return {
      visibleTextParts: textParts.map((part) => part.content),
      suppressedToolCallTextCount: 0,
    }
  }

  let suppressedToolCallTextCount = 0
  const visibleTextParts = textParts
    .map((part) => part.content.trim())
    .filter((content) => {
      if (!looksLikeLeakedToolCall(content)) {
        return true
      }

      suppressedToolCallTextCount += 1
      return false
    })

  return { visibleTextParts, suppressedToolCallTextCount }
}

function looksLikeLeakedToolCall(content: string) {
  const normalized = stripCodeFence(content)
  if (!normalized.startsWith("{") || !normalized.endsWith("}")) return false

  try {
    const parsed = JSON.parse(normalized) as { name?: unknown; parameters?: unknown }
    return (
      typeof parsed.name === "string"
      && parsed.name.startsWith("get_")
      && "parameters" in parsed
    )
  } catch {
    return false
  }
}

function stripCodeFence(content: string) {
  return content
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/, "")
    .trim()
}

function isNavigationAction(value: unknown): value is ChatNavigationAction {
  if (!value || typeof value !== "object") return false
  const candidate = value as Partial<ChatNavigationAction>
  return candidate.kind === "navigation" && typeof candidate.label === "string" && typeof candidate.to === "string"
}
