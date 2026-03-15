export const DEFAULT_CATEGORIES = [
  {
    name: "Groceries",
    color: "#22c55e",
    icon: "ShoppingCart",
    type: "expense" as const,
  },
  {
    name: "Bills & Utilities",
    color: "#f97316",
    icon: "Zap",
    type: "expense" as const,
  },
  {
    name: "Entertainment",
    color: "#a855f7",
    icon: "Tv",
    type: "expense" as const,
  },
  {
    name: "Transport",
    color: "#3b82f6",
    icon: "Car",
    type: "expense" as const,
  },
  {
    name: "Dining Out",
    color: "#ec4899",
    icon: "UtensilsCrossed",
    type: "expense" as const,
  },
  {
    name: "Shopping",
    color: "#f59e0b",
    icon: "ShoppingBag",
    type: "expense" as const,
  },
  {
    name: "Health",
    color: "#14b8a6",
    icon: "Heart",
    type: "expense" as const,
  },
  {
    name: "Income",
    color: "#10b981",
    icon: "TrendingUp",
    type: "income" as const,
  },
  {
    name: "Transfers",
    color: "#6b7280",
    icon: "ArrowLeftRight",
    type: "transfer" as const,
  },
  {
    name: "Subscriptions",
    color: "#8b5cf6",
    icon: "RefreshCw",
    type: "expense" as const,
  },
  {
    name: "Cash",
    color: "#d97706",
    icon: "Banknote",
    type: "expense" as const,
  },
  {
    name: "Other",
    color: "#94a3b8",
    icon: "MoreHorizontal",
    type: "expense" as const,
  },
]

// MCC (Merchant Category Code) to category name mapping
export const MCC_CATEGORY_MAP: Record<string, string> = {
  // Groceries
  "5411": "Groceries",
  "5422": "Groceries",
  "5441": "Groceries",
  "5451": "Groceries",
  "5499": "Groceries",

  // Dining Out
  "5812": "Dining Out",
  "5814": "Dining Out",
  "5813": "Dining Out",
  "5811": "Dining Out",

  // Transport
  "4111": "Transport",
  "4112": "Transport",
  "4121": "Transport",
  "4131": "Transport",
  "5541": "Transport",
  "5542": "Transport",
  "5571": "Transport",
  "5599": "Transport",
  "7511": "Transport",
  "7512": "Transport",

  // Entertainment
  "7832": "Entertainment",
  "7922": "Entertainment",
  "7929": "Entertainment",
  "7991": "Entertainment",
  "7993": "Entertainment",
  "7994": "Entertainment",
  "7996": "Entertainment",
  "7999": "Entertainment",

  // Health
  "5912": "Health",
  "5047": "Health",
  "8011": "Health",
  "8021": "Health",
  "8031": "Health",
  "8049": "Health",
  "8099": "Health",

  // Shopping
  "5310": "Shopping",
  "5311": "Shopping",
  "5331": "Shopping",
  "5611": "Shopping",
  "5621": "Shopping",
  "5631": "Shopping",
  "5641": "Shopping",
  "5651": "Shopping",
  "5661": "Shopping",
  "5712": "Shopping",
  "5732": "Shopping",
  "5734": "Shopping",
  "5945": "Shopping",

  // Bills & Utilities
  "4900": "Bills & Utilities",
  "4911": "Bills & Utilities",
  "4941": "Bills & Utilities",
  "4961": "Bills & Utilities",
  "4814": "Bills & Utilities",
  "4899": "Bills & Utilities",

  // Cash
  "6010": "Cash",
  "6011": "Cash",

  // Subscriptions (digital services)
  "7372": "Subscriptions",
  "7375": "Subscriptions",
}
