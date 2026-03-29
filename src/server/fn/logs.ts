import { createServerFn } from "@tanstack/react-start";
import fs from "fs";
import path from "path";
import { z } from "zod";

const LOG_DIR = path.resolve(process.env["LOG_DIR"] ?? "logs");

export type LogEntry = {
  ts: string;
  level: "debug" | "info" | "warn" | "error";
  event: string;
  [key: string]: any;
};

export const getLogDates = createServerFn().handler(async () => {
  try {
    const files = fs.readdirSync(LOG_DIR);
    return files
      .filter((f) => /^app-\d{4}-\d{2}-\d{2}\.log$/.test(f))
      .map((f) => f.slice(4, 14))
      .sort()
      .reverse();
  } catch {
    return [] as string[];
  }
});

export const getLogs = createServerFn()
  .inputValidator(
    z.object({
      date: z.string().optional(),
      levels: z.array(z.enum(["debug", "info", "warn", "error"])).optional(),
      search: z.string().optional(),
      limit: z.number().optional(),
    }),
  )
  .handler(async ({ data }) => {
    const date = data.date ?? new Date().toISOString().slice(0, 10);
    const filePath = path.join(LOG_DIR, `app-${date}.log`);

    try {
      const content = fs.readFileSync(filePath, "utf8");
      const lines = content.trim().split("\n").filter(Boolean);

      let entries = lines
        .map((line) => {
          try {
            return JSON.parse(line) as LogEntry;
          } catch {
            return null;
          }
        })
        .filter((e): e is LogEntry => e !== null)
        .reverse(); // newest first

      if (data.levels?.length) {
        entries = entries.filter((e) => data.levels!.includes(e.level));
      }

      if (data.search?.trim()) {
        const q = data.search.toLowerCase();
        entries = entries.filter(
          (e) =>
            e.event.toLowerCase().includes(q) ||
            JSON.stringify(e).toLowerCase().includes(q),
        );
      }

      return entries.slice(0, data.limit ?? 500);
    } catch {
      return [] as LogEntry[];
    }
  });
