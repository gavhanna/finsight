"use client"

import { Badge } from "@/components/ui/badge"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import type { ChatContext, ChatScope } from "@/lib/ai-chat.types"

export function ChatContextBar({
  context,
  scope,
  onScopeChange,
}: {
  context: ChatContext
  scope: ChatScope
  onScopeChange: (value: ChatScope) => void
}) {
  return (
    <div className="flex flex-col gap-3 border-b px-4 py-3">
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="secondary">{context.page.title}</Badge>
        {context.page.entityLabel && <Badge variant="outline">{context.page.entityLabel}</Badge>}
        {context.filters.dateFrom && <Badge variant="outline">From {context.filters.dateFrom}</Badge>}
        {context.filters.dateTo && <Badge variant="outline">To {context.filters.dateTo}</Badge>}
        {context.filters.search && <Badge variant="outline">Search: {context.filters.search}</Badge>}
      </div>
      <Tabs value={scope} onValueChange={(value) => onScopeChange(value as ChatScope)}>
        <TabsList>
          <TabsTrigger value="page">Current Page</TabsTrigger>
          <TabsTrigger value="global">Whole App</TabsTrigger>
        </TabsList>
      </Tabs>
    </div>
  )
}

