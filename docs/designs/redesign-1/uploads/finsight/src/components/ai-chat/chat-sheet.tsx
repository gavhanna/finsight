"use client"

import { MessageSquareText } from "lucide-react"
import { ChatPanel } from "@/components/ai-chat/chat-panel"
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet"

export function ChatSheet({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full gap-0 p-0 sm:max-w-6xl" showCloseButton>
        <SheetHeader className="border-b">
          <SheetTitle className="flex items-center gap-2">
            <MessageSquareText className="size-4 text-primary" />
            AI Chat
          </SheetTitle>
          <SheetDescription>
            Page-aware finance chat grounded in your current data and filters.
          </SheetDescription>
        </SheetHeader>
        <ChatPanel />
      </SheetContent>
    </Sheet>
  )
}

