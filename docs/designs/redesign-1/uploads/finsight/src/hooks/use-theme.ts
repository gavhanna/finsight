import { useState, useEffect } from "react"

export type Theme = "light" | "dark" | "system"

export function useTheme() {
  const [theme, setThemeState] = useState<Theme>(() => {
    if (typeof window === "undefined") return "system"
    return (localStorage.getItem("theme") as Theme) ?? "system"
  })

  useEffect(() => {
    const root = document.documentElement

    if (theme === "system") {
      localStorage.setItem("theme", "system")
      const mq = window.matchMedia("(prefers-color-scheme: dark)")
      const apply = () => root.classList.toggle("dark", mq.matches)
      apply()
      mq.addEventListener("change", apply)
      return () => mq.removeEventListener("change", apply)
    }

    localStorage.setItem("theme", theme)
    root.classList.toggle("dark", theme === "dark")
  }, [theme])

  return { theme, setTheme: setThemeState }
}
