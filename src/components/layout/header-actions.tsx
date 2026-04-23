import { createContext, useContext, useState, type ReactNode } from "react"

type HeaderActionContextValue = {
  action: ReactNode
  setAction: (action: ReactNode) => void
}

const HeaderActionContext = createContext<HeaderActionContextValue | null>(null)

export function HeaderActionProvider({ children }: { children: ReactNode }) {
  const [action, setAction] = useState<ReactNode>(null)

  return (
    <HeaderActionContext.Provider value={{ action, setAction }}>
      {children}
    </HeaderActionContext.Provider>
  )
}

export function HeaderActionSlot() {
  const context = useContext(HeaderActionContext)
  return context?.action ?? null
}

export function useHeaderAction() {
  const context = useContext(HeaderActionContext)
  if (!context) {
    throw new Error("useHeaderAction must be used within HeaderActionProvider.")
  }
  return context.setAction
}
