"use client"

import { createContext, useContext, useState } from "react"
import { useRouterState } from "@tanstack/react-router"
import { ChatSheet } from "@/components/ai-chat/chat-sheet"
import { deriveChatContext } from "@/lib/ai-chat.page-context"
import type { ChatContext, ChatScope } from "@/lib/ai-chat.types"

type AiChatState = {
  open: boolean
  setOpen: (open: boolean) => void
  scope: ChatScope
  setScope: (scope: ChatScope) => void
  currentContext: ChatContext
}

const AiChatContext = createContext<AiChatState | null>(null)

export function AiChatProvider({ children }: { children: React.ReactNode }) {
  const { location } = useRouterState()
  const [open, setOpen] = useState(false)
  const [scope, setScope] = useState<ChatScope>("page")
  const currentContext = deriveChatContext(
    location.pathname,
    (location.search as Record<string, unknown> | undefined) ?? undefined,
  )

  return (
    <AiChatContext.Provider value={{ open, setOpen, scope, setScope, currentContext }}>
      {children}
      <ChatSheet open={open} onOpenChange={setOpen} />
    </AiChatContext.Provider>
  )
}

export function useAiChat() {
  const value = useContext(AiChatContext)
  if (!value) throw new Error("useAiChat must be used within AiChatProvider")
  return value
}

