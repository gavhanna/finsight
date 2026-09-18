import { createServerFn } from "@tanstack/react-start";
import { db } from "../../db/index.server";
import {
  categories,
  categoryGroups,
  rules,
  rulePatterns,
  transactions,
} from "../../db/schema";
import { eq, sql, inArray, type SQL } from "drizzle-orm";
import { z } from "zod";
import { invalidateCategoryCache } from "../services/categoriser.server";
import { log } from "../../lib/logger.server";

const FieldSchema = z.enum([
  "description",
  "creditorName",
  "debtorName",
  "merchantCategoryCode",
]);
const MatchTypeSchema = z.enum(["contains", "exact", "startsWith"]);

// ── Category Groups ───────────────────────────────────────────────────────────

export const getCategoryGroups = createServerFn().handler(async () => {
  return db.select().from(categoryGroups).orderBy(categoryGroups.name);
});

export const createCategoryGroup = createServerFn()
  .inputValidator(
    z.object({ name: z.string().min(1), color: z.string().default("#94a3b8") }),
  )
  .handler(async ({ data }) => {
    const [group] = await db.insert(categoryGroups).values(data).returning();
    log.info("categoryGroup.created", { id: group.id, name: group.name });
    return group;
  });

export const updateCategoryGroup = createServerFn()
  .inputValidator(
    z.object({
      id: z.number(),
      name: z.string().min(1).optional(),
      color: z.string().optional(),
    }),
  )
  .handler(async ({ data: { id, ...rest } }) => {
    await db.update(categoryGroups).set(rest).where(eq(categoryGroups.id, id));
    log.info("categoryGroup.updated", { id, fields: Object.keys(rest) });
  });

export const deleteCategoryGroup = createServerFn()
  .inputValidator(z.number())
  .handler(async ({ data: id }) => {
    await db.delete(categoryGroups).where(eq(categoryGroups.id, id));
    log.info("categoryGroup.deleted", { id });
  });

export const assignCategoryGroup = createServerFn()
  .inputValidator(
    z.object({ categoryId: z.number(), groupId: z.number().nullable() }),
  )
  .handler(async ({ data: { categoryId, groupId } }) => {
    await db
      .update(categories)
      .set({ groupId })
      .where(eq(categories.id, categoryId));
  });

// ── Categories ────────────────────────────────────────────────────────────────

export const getCategories = createServerFn().handler(async () => {
  return db.select().from(categories).orderBy(categories.name);
});

export const getCategoriesWithRules = createServerFn().handler(async () => {
  const cats = await db.select().from(categories).orderBy(categories.name);
  const groups = await db.select().from(categoryGroups);
  const allRules = await db.select().from(rules);
  const txCounts = await db
    .select({
      categoryId: transactions.categoryId,
      count: sql<number>`count(*)`,
    })
    .from(transactions)
    .groupBy(transactions.categoryId);
  return cats.map((cat) => ({
    ...cat,
    groupName: groups.find((g) => g.id === cat.groupId)?.name ?? null,
    rules: allRules.filter((r) => r.categoryId === cat.id).length,
    transactionCount: Number(
      txCounts.find((r) => r.categoryId === cat.id)?.count ?? 0,
    ),
  }));
});

export const createCategory = createServerFn()
  .inputValidator(
    z.object({
      name: z.string().min(1),
      color: z.string().default("#94a3b8"),
      icon: z.string().optional(),
      type: z.enum(["expense", "income", "transfer"]).default("expense"),
    }),
  )
  .handler(async ({ data }) => {
    const [cat] = await db.insert(categories).values(data).returning();
    invalidateCategoryCache();
    log.info("category.created", {
      id: cat.id,
      name: cat.name,
      type: cat.type,
    });
    return cat;
  });

export const updateCategory = createServerFn()
  .inputValidator(
    z.object({
      id: z.number(),
      name: z.string().min(1).optional(),
      color: z.string().optional(),
      icon: z.string().optional(),
      type: z.enum(["expense", "income", "transfer"]).optional(),
      groupId: z.number().nullable().optional(),
    }),
  )
  .handler(async ({ data: { id, ...rest } }) => {
    await db.update(categories).set(rest).where(eq(categories.id, id));
    invalidateCategoryCache();
    log.info("category.updated", { id, fields: Object.keys(rest) });
  });

export const deleteCategory = createServerFn()
  .inputValidator(z.number())
  .handler(async ({ data: id }) => {
    await db.delete(categories).where(eq(categories.id, id));
    invalidateCategoryCache();
    log.info("category.deleted", { id });
  });

// ── Rules ─────────────────────────────────────────────────────────────────────

export const getAllRules = createServerFn().handler(async () => {
  const allRules = await db.select().from(rules).orderBy(rules.priority);
  const patterns = await db.select().from(rulePatterns);
  const cats = await db.select().from(categories);
  return allRules.map((r) => ({
    ...r,
    category: cats.find((c) => c.id === r.categoryId) ?? null,
    patterns: patterns.filter((p) => p.ruleId === r.id),
  }));
});

export const createRule = createServerFn()
  .inputValidator(
    z.object({
      name: z.string().min(1),
      categoryId: z.number(),
      priority: z.number().default(0),
      patterns: z
        .array(
          z.object({
            pattern: z.string().min(1),
            field: FieldSchema,
            matchType: MatchTypeSchema,
          }),
        )
        .min(1),
    }),
  )
  .handler(async ({ data }) => {
    const [rule] = await db
      .insert(rules)
      .values({
        name: data.name,
        categoryId: data.categoryId,
        priority: data.priority,
      })
      .returning();
    for (const p of data.patterns) {
      await db.insert(rulePatterns).values({ ruleId: rule.id, ...p });
    }
    invalidateCategoryCache();
    log.info("rule.created", {
      id: rule.id,
      name: rule.name,
      categoryId: rule.categoryId,
      patternCount: data.patterns.length,
    });
    return rule;
  });

export const updateRule = createServerFn()
  .inputValidator(
    z.object({
      id: z.number(),
      name: z.string().min(1).optional(),
      categoryId: z.number().optional(),
      priority: z.number().optional(),
    }),
  )
  .handler(async ({ data: { id, ...rest } }) => {
    await db.update(rules).set(rest).where(eq(rules.id, id));
    invalidateCategoryCache();
    log.info("rule.updated", { id, fields: Object.keys(rest) });
  });

export const deleteRule = createServerFn()
  .inputValidator(z.number())
  .handler(async ({ data: id }) => {
    await db.delete(rules).where(eq(rules.id, id));
    invalidateCategoryCache();
    log.info("rule.deleted", { id });
  });

export const addPattern = createServerFn()
  .inputValidator(
    z.object({
      ruleId: z.number(),
      pattern: z.string().min(1),
      field: FieldSchema,
      matchType: MatchTypeSchema,
    }),
  )
  .handler(async ({ data }) => {
    const [p] = await db.insert(rulePatterns).values(data).returning();
    invalidateCategoryCache();
    return p;
  });

export const updatePattern = createServerFn()
  .inputValidator(
    z.object({
      id: z.number(),
      pattern: z.string().min(1).optional(),
      field: FieldSchema.optional(),
      matchType: MatchTypeSchema.optional(),
    }),
  )
  .handler(async ({ data: { id, ...rest } }) => {
    await db.update(rulePatterns).set(rest).where(eq(rulePatterns.id, id));
    invalidateCategoryCache();
  });

export const deletePattern = createServerFn()
  .inputValidator(z.number())
  .handler(async ({ data: id }) => {
    await db.delete(rulePatterns).where(eq(rulePatterns.id, id));
    invalidateCategoryCache();
  });

// ── Preview & apply ───────────────────────────────────────────────────────────

async function runPreview(condition: SQL) {
  const rows = await db
    .select({
      id: transactions.id,
      bookingDate: transactions.bookingDate,
      amount: transactions.amount,
      currency: transactions.currency,
      creditorName: transactions.creditorName,
      debtorName: transactions.debtorName,
      description: transactions.description,
      categoryId: transactions.categoryId,
      categorisedBy: transactions.categorisedBy,
    })
    .from(transactions)
    .where(condition)
    .orderBy(transactions.bookingDate)
    .limit(200);

  const cats = await db.select().from(categories);
  return {
    count: rows.length,
    capped: rows.length === 200,
    transactions: rows.map((r) => ({
      ...r,
      category: cats.find((c) => c.id === r.categoryId) ?? null,
    })),
  };
}

function buildPatternCondition(
  pattern: string,
  field: "description" | "creditorName" | "debtorName" | "merchantCategoryCode",
  matchType: "contains" | "exact" | "startsWith",
) {
  const col = {
    description: transactions.description,
    creditorName: transactions.creditorName,
    debtorName: transactions.debtorName,
    merchantCategoryCode: transactions.merchantCategoryCode,
  }[field];
  if (matchType === "contains") return sql`${col} ILIKE ${"%" + pattern + "%"}`;
  if (matchType === "startsWith") return sql`${col} ILIKE ${pattern + "%"}`;
  return sql`lower(${col}) = lower(${pattern})`;
}

export const previewRule = createServerFn()
  .inputValidator(
    z.object({
      pattern: z.string().min(1),
      field: FieldSchema,
      matchType: MatchTypeSchema,
    }),
  )
  .handler(async ({ data: { pattern, field, matchType } }) => {
    return runPreview(buildPatternCondition(pattern, field, matchType));
  });

const PatternInput = z.object({
  pattern: z.string().min(1),
  field: FieldSchema,
  matchType: MatchTypeSchema,
});

export const previewPatterns = createServerFn()
  .inputValidator(z.object({ patterns: z.array(PatternInput).min(1) }))
  .handler(async ({ data: { patterns: pats } }) => {
    const conditions = pats.map((p) =>
      buildPatternCondition(p.pattern, p.field, p.matchType),
    );
    const condition =
      conditions.length === 1
        ? conditions[0]
        : sql`(${sql.join(conditions, sql` OR `)})`;
    return runPreview(condition);
  });

export const applyRuleToHistory = createServerFn()
  .inputValidator(z.object({ ruleId: z.number(), categoryId: z.number() }))
  .handler(async ({ data: { ruleId, categoryId } }) => {
    const patterns = await db
      .select()
      .from(rulePatterns)
      .where(eq(rulePatterns.ruleId, ruleId));
    if (patterns.length === 0) return { updated: 0 };

    const orConditions = patterns.map((p) =>
      buildPatternCondition(p.pattern, p.field, p.matchType),
    );
    const matchCondition =
      orConditions.length === 1
        ? orConditions[0]
        : sql`(${sql.join(orConditions, sql` OR `)})`;

    const matching = await db
      .select({ id: transactions.id })
      .from(transactions)
      .where(matchCondition);

    if (matching.length === 0) return { updated: 0 };

    await db
      .update(transactions)
      .set({ categoryId, categorisedBy: "rule" })
      .where(
        inArray(
          transactions.id,
          matching.map((r) => r.id),
        ),
      );

    log.info("rule.applied_to_history", {
      ruleId,
      categoryId,
      updated: matching.length,
    });
    return { updated: matching.length };
  });
