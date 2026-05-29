"use client";

import { useEffect, useState } from "react";

export default function ThemeToggle() {
  const [theme, setTheme] = useState<"light" | "dark">("dark");

  useEffect(() => {
    const current = (document.documentElement.dataset.theme as "light" | "dark") || "dark";
    setTheme(current);
  }, []);

  function toggle() {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    document.documentElement.dataset.theme = next;
    try {
      localStorage.setItem("theme", next);
    } catch {}
  }

  const isDark = theme === "dark";

  return (
    <button
      onClick={toggle}
      className="relative w-14 h-7 rounded-full border border-[var(--panel-border)] bg-[var(--input-bg)] transition hover:border-[var(--accent)]/40"
      aria-label={isDark ? "切换到白天模式" : "切换到黑夜模式"}
      title={isDark ? "切换到白天模式" : "切换到黑夜模式"}
    >
      <span
        className={`absolute top-[2px] left-[2px] w-[22px] h-[22px] rounded-full bg-gradient-to-br from-[#4f8ff7] to-[#7c6cf6] shadow-md grid place-items-center text-[11px] transition-transform duration-300 ${
          isDark ? "translate-x-0" : "translate-x-7"
        }`}
      >
        {isDark ? "🌙" : "☀️"}
      </span>
    </button>
  );
}
