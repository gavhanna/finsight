"use client"

import { useMemo, useState } from "react"
import { Eraser, Send, Square } from "lucide-react"
import { fetchServerSentEvents, useChat } from "@tanstack/ai-react"
import type { UIMessage } from "@tanstack/ai"
import { Alert } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ChatContextBar } from "@/components/ai-chat/chat-context-bar"
import { ChatMessage } from "@/components/ai-chat/chat-message"
import { ChatStarters } from "@/components/ai-chat/chat-starters"
import { useAiChat } from "@/components/ai-chat/chat-provider"

const chatConnection = fetchServerSentEvents("/api/chat")

export function ChatPanel() {
  const { currentContext, scope, setScope } = useAiChat()
  const [input, setInput] = useState("")
  const body = useMemo(
    () => ({
      data: {
        context: currentContext,
        scope,
      },
    }),
    [currentContext, scope],
  )
  const { messages, sendMessage, clear, stop, isLoading, error } = useChat({
    connection: chatConnection,
    body,
  })

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!input.trim()) return
    const next = input.trim()
    setInput("")
    await sendMessage(next)
  }

  async function handleStarter(prompt: string) {
    await sendMessage(prompt)
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <ChatContextBar context={currentContext} scope={scope} onScopeChange={setScope} />
      {messages.length === 0 && <ChatStarters pageKind={currentContext.page.kind} onSelect={handleStarter} />}

      <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-auto px-4 py-4">
        {messages.length === 0 ? (
          <div className="rounded-2xl border border-dashed px-4 py-8 text-sm text-muted-foreground">
            Ask about the current page, compare periods, investigate spending changes, or switch to whole-app mode for broader questions.
          </div>
        ) : (
          messages.map((message) => (
            <ChatMessage key={message.id} message={message as UIMessage} />
          ))
        )}
      </div>

      {error && (
        <div className="px-4 pb-3">
          <Alert>{error.message}</Alert>
        </div>
      )}

      <div className="border-t px-4 py-4">
        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <Input
            value={input}
            onChange={(event) => setInput(event.target.value)}
            placeholder="Ask about your finances..."
            disabled={isLoading}
          />
          <div className="flex items-center justify-between gap-2">
            <Button type="button" variant="ghost" size="sm" onClick={clear} disabled={messages.length === 0 || isLoading}>
              <Eraser data-icon="inline-start" />
              Clear
            </Button>
            <div className="flex items-center gap-2">
              {isLoading && (
                <Button type="button" variant="outline" size="sm" onClick={stop}>
                  <Square data-icon="inline-start" />
                  Stop
                </Button>
              )}
              <Button type="submit" size="sm" disabled={!input.trim()}>
                <Send data-icon="inline-start" />
                Send
              </Button>
            </div>
          </div>
        </form>
      </div>
    </div>
  )
}
