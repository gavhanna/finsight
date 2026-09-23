import { useState } from "react";
import { useRouter } from "@tanstack/react-router";
import { formatCurrency } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, Pencil, Trash2 } from "lucide-react";
import {
  upsertBudget,
  deleteBudget,
  type BudgetRow,
} from "@/server/fn/budgets";

type BudgetDialogState = { mode: "add" } | { mode: "edit"; budget: BudgetRow };

export function ManageTab({
  allBudgets,
  categories,
  groups,
  currency,
}: {
  allBudgets: BudgetRow[];
  categories: {
    id: number;
    name: string;
    color: string;
    groupId: number | null;
  }[];
  groups: { id: number; name: string; color: string }[];
  currency: string;
}) {
  const router = useRouter();
  const [dialog, setDialog] = useState<BudgetDialogState | null>(null);
  const [targetType, setTargetType] = useState<"category" | "group">(
    "category",
  );
  const [selectedId, setSelectedId] = useState<string>("");
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);
  const [deleting, setDeleting] = useState(false);

  const budgetedCategoryIds = new Set(
    allBudgets.map((b) => b.categoryId).filter(Boolean) as number[],
  );
  const budgetedGroupIds = new Set(
    allBudgets.map((b) => b.categoryGroupId).filter(Boolean) as number[],
  );

  const groupCoveredCatIds = new Set(
    groups
      .filter((g) => budgetedGroupIds.has(g.id))
      .flatMap((g) =>
        categories.filter((c) => c.groupId === g.id).map((c) => c.id),
      ),
  );

  function openAdd() {
    setTargetType("category");
    setSelectedId("");
    setAmount("");
    setNote("");
    setDialog({ mode: "add" });
  }

  function openEdit(b: BudgetRow) {
    setTargetType(b.categoryId ? "category" : "group");
    setSelectedId(String(b.categoryId ?? b.categoryGroupId ?? ""));
    setAmount(String(b.monthlyAmount));
    setNote(b.note ?? "");
    setDialog({ mode: "edit", budget: b });
  }

  function closeDialog() {
    setDialog(null);
    setSelectedId("");
    setAmount("");
    setNote("");
  }

  async function handleSave() {
    const amt = parseFloat(amount);
    if (isNaN(amt) || amt <= 0 || !selectedId) return;
    setSaving(true);
    try {
      await upsertBudget({
        data: {
          id: dialog?.mode === "edit" ? dialog.budget.id : undefined,
          categoryId: targetType === "category" ? Number(selectedId) : null,
          categoryGroupId: targetType === "group" ? Number(selectedId) : null,
          monthlyAmount: amt,
          note: note.trim() || undefined,
        },
      });
      closeDialog();
      router.invalidate();
    } finally {
      setSaving(false);
    }
  }

  async function confirmDelete() {
    if (confirmDeleteId === null) return;
    setDeleting(true);
    await deleteBudget({ data: { id: confirmDeleteId } });
    setDeleting(false);
    setConfirmDeleteId(null);
    router.invalidate();
  }

  const availableCategories = categories.filter((c) => {
    if (dialog?.mode === "edit" && dialog.budget.categoryId === c.id)
      return true;
    return !budgetedCategoryIds.has(c.id) && !groupCoveredCatIds.has(c.id);
  });
  const availableGroups = groups.filter((g) => {
    if (dialog?.mode === "edit" && dialog.budget.categoryGroupId === g.id)
      return true;
    return !budgetedGroupIds.has(g.id);
  });

  const canSave = selectedId && parseFloat(amount) > 0;

  return (
    <div id="envelope-setup" className="flex scroll-mt-24 flex-col gap-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {allBudgets.length === 0
            ? "No envelopes yet — add one to start planning."
            : `${allBudgets.length} standing envelope${allBudgets.length !== 1 ? "s" : ""}`}
        </p>
        <Button size="sm" onClick={openAdd} className="gap-1.5">
          <Plus data-icon="inline-start" />
          Add envelope
        </Button>
      </div>

      {allBudgets.length > 0 && (
        <Card>
          <CardContent className="p-0">
            <div className="divide-y">
              {allBudgets.map((b) => {
                const isCategory = b.categoryId !== null;
                const name = isCategory ? b.categoryName : b.groupName;
                const color = isCategory ? b.categoryColor : b.groupColor;

                return (
                  <div
                    key={b.id}
                    className="flex items-center gap-3 px-5 py-3.5 group"
                  >
                    <div
                      className="h-2.5 w-2.5 shrink-0 rounded-full"
                      style={{ backgroundColor: color ?? "#888" }}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium truncate">
                          {name}
                        </span>
                        <span className="text-[10px] text-muted-foreground border rounded px-1 py-0.5 shrink-0">
                          {isCategory ? "category" : "group"}
                        </span>
                      </div>
                      {b.note && (
                        <p className="text-xs text-muted-foreground truncate mt-0.5">
                          {b.note}
                        </p>
                      )}
                    </div>
                    <span className="text-sm font-medium tabular-nums shrink-0">
                      {formatCurrency(b.monthlyAmount, currency)}/mo
                    </span>
                    <div className="flex items-center gap-1">
                      <Button
                        aria-label={`Edit ${name ?? "envelope"}`}
                        variant="ghost"
                        size="icon"
                        className="size-7 text-muted-foreground hover:text-foreground"
                        onClick={() => openEdit(b)}
                      >
                        <Pencil />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label={`Delete ${name ?? "envelope"}`}
                        className="size-7 text-muted-foreground hover:text-negative"
                        onClick={() => setConfirmDeleteId(b.id)}
                      >
                        <Trash2 />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      <Dialog
        open={confirmDeleteId !== null}
        onOpenChange={(o) => {
          if (!o && !deleting) setConfirmDeleteId(null);
        }}
      >
        <DialogContent className="sm:max-w-xs">
          <DialogHeader>
            <DialogTitle>Delete envelope?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            This envelope and its monthly overrides will be permanently removed.
            Transactions are not affected.
          </p>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setConfirmDeleteId(null)}
              disabled={deleting}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={confirmDelete}
              disabled={deleting}
            >
              {deleting ? "Deleting…" : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={dialog !== null}
        onOpenChange={(o) => {
          if (!o) closeDialog();
        }}
      >
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>
              {dialog?.mode === "edit" ? "Edit envelope" : "Add envelope"}
            </DialogTitle>
          </DialogHeader>

          <FieldGroup>
            {dialog?.mode === "add" && (
              <Field>
                <FieldLabel>Envelope type</FieldLabel>
                <Tabs
                  value={targetType}
                  onValueChange={(value) => {
                    if (value) {
                      setTargetType(value as "category" | "group");
                      setSelectedId("");
                    }
                  }}
                >
                  <TabsList>
                    <TabsTrigger value="category">Category</TabsTrigger>
                    <TabsTrigger value="group">Group</TabsTrigger>
                  </TabsList>
                </Tabs>
              </Field>
            )}

            <Field>
              <FieldLabel>
                {targetType === "category" ? "Category" : "Group"}
              </FieldLabel>
              <Select
                value={selectedId}
                onValueChange={(v) => v !== null && setSelectedId(v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder={`Select a ${targetType}…`}>
                    {(() => {
                      const item =
                        targetType === "category"
                          ? availableCategories.find(
                              (c) => String(c.id) === selectedId,
                            )
                          : availableGroups.find(
                              (g) => String(g.id) === selectedId,
                            );
                      return item ? (
                        <span className="flex items-center gap-2">
                          <span
                            className="h-2 w-2 rounded-full shrink-0"
                            style={{ backgroundColor: item.color }}
                          />
                          {item.name}
                        </span>
                      ) : undefined;
                    })()}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    {targetType === "category"
                      ? availableCategories.map((c) => (
                          <SelectItem
                            key={c.id}
                            value={String(c.id)}
                            startIcon={
                              <span
                                className="h-2 w-2 rounded-full"
                                style={{ backgroundColor: c.color }}
                              />
                            }
                          >
                            {c.name}
                          </SelectItem>
                        ))
                      : availableGroups.map((g) => (
                          <SelectItem
                            key={g.id}
                            value={String(g.id)}
                            startIcon={
                              <span
                                className="h-2 w-2 rounded-full"
                                style={{ backgroundColor: g.color }}
                              />
                            }
                          >
                            {g.name}
                          </SelectItem>
                        ))}
                    {(targetType === "category"
                      ? availableCategories
                      : availableGroups
                    ).length === 0 && (
                      <div className="px-3 py-4 text-sm text-muted-foreground text-center">
                        All{" "}
                        {targetType === "category" ? "categories" : "groups"}{" "}
                        already have envelopes.
                      </div>
                    )}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </Field>

            <Field>
              <FieldLabel htmlFor="budget-amount">Monthly amount</FieldLabel>
              <Input
                id="budget-amount"
                type="number"
                min="0.01"
                step="0.01"
                placeholder="0.00"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
            </Field>

            <Field>
              <FieldLabel htmlFor="budget-note">
                Note{" "}
                <span className="text-muted-foreground font-normal">
                  (optional)
                </span>
              </FieldLabel>
              <Input
                id="budget-note"
                placeholder="e.g. includes takeaways"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && canSave) handleSave();
                }}
              />
            </Field>
          </FieldGroup>

          <DialogFooter>
            <Button variant="outline" onClick={closeDialog}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={!canSave || saving}>
              {saving
                ? "Saving…"
                : dialog?.mode === "edit"
                  ? "Save changes"
                  : "Add envelope"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
