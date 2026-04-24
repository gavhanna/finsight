"use client"

import { Button } from "@/components/ui/button"
import type { ChatPageKind } from "@/lib/ai-chat.types"

const STARTERS: Record<ChatPageKind, string[]> = {
  "dashboard": [
    "Summarize this page for me.",
    "What stands out here?",
    "What changed most recently?",
    "Any savings opportunities?",
  ],
  "transactions": [
    "Summarize this page for me.",
    "Why is spending high?",
    "What patterns are in these transactions?",
    "Which merchants matter most here?",
  ],
  "budgets": [
    "Summarize this page for me.",
    "Which budgets need attention?",
    "Where are we overspending?",
    "What should we rebalance?",
  ],
  "recurring": [
    "Summarize this page for me.",
    "What recurring payments should we review?",
    "Which commitments cost the most monthly?",
    "Any suspicious recurring items?",
  ],
  "merchant-detail": [
    "Summarize this merchant for me.",
    "Has this merchant changed recently?",
    "Is this spend unusual?",
  ],
  "category-trends": [
    "Summarize this page for me.",
    "What changed in these category trends?",
    "Which categories are driving the movement?",
    "What should we investigate next?",
  ],
  "monthly-comparison": [
    "Summarize this comparison.",
    "What changed versus last year?",
    "Where is the biggest difference?",
  ],
  "unknown": [
    "Summarize this page for me.",
    "What stands out on this page?",
    "What should I look into next?",
    "Summarize the current context.",
  ],
}

export function ChatStarters({
  pageKind,
  onSelect,
}: {
  pageKind: ChatPageKind
  onSelect: (prompt: string) => void
}) {
  return (
    <div className="flex flex-wrap gap-2 px-4 pb-2">
      {STARTERS[pageKind].map((prompt) => (
        <Button key={prompt} variant="outline" size="sm" onClick={() => onSelect(prompt)}>
          {prompt}
        </Button>
      ))}
    </div>
  )
}
