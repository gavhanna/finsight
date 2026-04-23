import { createFileRoute, useRouter } from "@tanstack/react-router";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { z } from "zod";
import { CategoryDot } from "@/components/rules/category-dot";
import { TransactionChartPanel } from "@/components/transactions/chart-panel";
import { TransactionFilters } from "@/components/transactions/transaction-filters";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { SortableHead } from "@/components/ui/sortable-head";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
import { useSortable } from "@/hooks/use-sortable";
import { withOfflineCache } from "@/lib/loader-cache";
import { formatCurrency, formatDate } from "@/lib/utils";
import { PageAiSummaryDialog } from "@/components/ai-summary-dialog";
import { useHeaderAction } from "@/components/layout/header-actions";
import { getCategories } from "../../server/fn/categories";
import { getAccounts } from "../../server/fn/insights";
import type { getTransactionStats as getTransactionStatsType } from "../../server/fn/transactions";
import {
	bulkCategorise,
	getTransactionStats,
	getTransactions,
	updateTransactionCategory,
} from "../../server/fn/transactions";

type ChartStats = Awaited<ReturnType<typeof getTransactionStatsType>>;

const SearchSchema = z.object({
	page: z.coerce.number().default(1),
	search: z.string().optional(),
	dateFrom: z.string().optional(),
	dateTo: z.string().optional(),
	categoryId: z.coerce.number().optional(),
	accountIds: z.array(z.string()).optional(),
});

export const Route = createFileRoute("/transactions/")({
	validateSearch: SearchSchema,
	component: TransactionsPage,
	loaderDeps: ({ search }) => search,
	loader: ({ deps }) =>
		withOfflineCache("transactions", async () => {
			const [txData, categories, accounts] = await Promise.all([
				getTransactions({
					data: { ...deps, accountIds: deps.accountIds ?? [] },
				}),
				getCategories(),
				getAccounts(),
			]);
			return { txData, categories, accounts };
		}),
});

function TransactionsPage() {
	const { txData, categories, accounts } = Route.useLoaderData();
	const search = Route.useSearch();
	const navigate = Route.useNavigate();
	const router = useRouter();
	const setHeaderAction = useHeaderAction();
	const [selected, setSelected] = useState<Set<string>>(new Set());
	const [bulkCatId, setBulkCatId] = useState<string>("");
	const [loading, setLoading] = useState(false);
	const [searchInput, setSearchInput] = useState(search.search ?? "");
	const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
	const [showChart, setShowChart] = useState(false);
	const [chartStats, setChartStats] = useState<ChartStats | null>(null);
	const [chartLoading, setChartLoading] = useState(false);

	const hasSearch = !!search.search?.trim();
	const hasChartFilter = hasSearch || search.categoryId !== undefined;

	function handleSearchChange(value: string) {
		setSearchInput(value);
		if (debounceRef.current) clearTimeout(debounceRef.current);
		debounceRef.current = setTimeout(() => {
			updateSearch({ search: value || undefined });
		}, 400);
	}

	useEffect(() => {
		if (!showChart || !hasChartFilter) return;
		setChartStats(null);
		setChartLoading(true);
		getTransactionStats({
			data: {
				search: search.search,
				dateFrom: search.dateFrom,
				dateTo: search.dateTo,
				categoryId: search.categoryId,
				accountIds: search.accountIds ?? [],
			},
		}).then((s) => {
			setChartStats(s);
			setChartLoading(false);
		});
	}, [
		showChart,
		hasChartFilter,
		search.search,
		search.dateFrom,
		search.dateTo,
		search.categoryId,
		search.accountIds,
	]);

	const {
		sorted: transactions,
		sortKey,
		sortDir,
		toggle,
	} = useSortable(txData.transactions, "bookingDate", "desc");
	const { total, page, pageSize } = txData;
	const totalPages = Math.ceil(total / pageSize);
	const selectedCategory = categories.find((category) => category.id === search.categoryId);
	const selectedAccount = accounts.find((account) => account.id === (search.accountIds ?? [])[0]);
	const totalIncome = transactions.filter((tx) => tx.amount > 0).reduce((sum, tx) => sum + tx.amount, 0);
	const totalExpenses = Math.abs(transactions.filter((tx) => tx.amount < 0).reduce((sum, tx) => sum + tx.amount, 0));
	const topVisibleMerchants = useMemo(() => {
		const merchants = new Map<string, { name: string; total: number; count: number }>();
		for (const tx of transactions) {
			if (tx.amount >= 0) continue;
			const name = tx.creditorName ?? tx.debtorName ?? tx.description ?? "Unknown";
			const current = merchants.get(name) ?? { name, total: 0, count: 0 };
			current.total += Math.abs(tx.amount);
			current.count += 1;
			merchants.set(name, current);
		}
		return [...merchants.values()].sort((a, b) => b.total - a.total).slice(0, 5);
	}, [transactions]);

	const aiSummaryAction = useMemo(() => {
		if (total === 0) return null;
		return (
			<PageAiSummaryDialog
				request={{
					pageTitle: "Transactions",
					filters: {
						dateFrom: search.dateFrom,
						dateTo: search.dateTo,
						presetLabel: search.search ? `Search: ${search.search}` : "Current transaction filters",
						accountLabel: selectedAccount?.name ?? selectedAccount?.iban ?? "All accounts",
					},
					totalIncome,
					totalExpenses,
					net: totalIncome - totalExpenses,
					transactionCount: total,
					topMerchants: topVisibleMerchants,
					currency: transactions[0]?.currency ?? "EUR",
					contextSections: [
						{
							title: "Active filters",
							lines: [
								`Category: ${selectedCategory?.name ?? "All categories"}`,
								`Search text: ${search.search?.trim() || "none"}`,
								`Page ${page} of ${totalPages || 1}; ${transactions.length} transactions visible on this page`,
							],
						},
						{
							title: "Visible transaction sample",
							lines: transactions.slice(0, 8).map((tx) =>
								`${tx.bookingDate}: ${tx.creditorName ?? tx.debtorName ?? tx.description ?? "Unknown"} ${formatCurrency(tx.amount, tx.currency)} (${tx.category?.name ?? "Uncategorised"})`,
							),
						},
					],
				}}
			/>
		);
	}, [
		page,
		search.accountIds,
		search.categoryId,
		search.dateFrom,
		search.dateTo,
		search.search,
		selectedAccount?.iban,
		selectedAccount?.name,
		selectedCategory?.name,
		topVisibleMerchants,
		total,
		totalExpenses,
		totalIncome,
		totalPages,
		transactions,
	]);

	useEffect(() => {
		setHeaderAction(aiSummaryAction);
		return () => setHeaderAction(null);
	}, [aiSummaryAction, setHeaderAction]);

	function updateSearch(updates: Partial<z.infer<typeof SearchSchema>>) {
		navigate({ search: { ...search, ...updates, page: 1 } });
	}

	function toggleSelect(id: string) {
		setSelected((s) => {
			const ns = new Set(s);
			if (ns.has(id)) ns.delete(id);
			else ns.add(id);
			return ns;
		});
	}

	function toggleAll() {
		if (selected.size === transactions.length) setSelected(new Set());
		else setSelected(new Set(transactions.map((t) => t.id)));
	}

	function openTransaction(txId: string) {
		navigate({
			to: "/transactions/$transactionId",
			params: { transactionId: encodeURIComponent(txId) },
			search,
		});
	}

	async function handleBulkCategorise() {
		if (!bulkCatId || selected.size === 0) return;
		setLoading(true);
		await bulkCategorise({
			data: { ids: Array.from(selected), categoryId: Number(bulkCatId) },
		});
		setSelected(new Set());
		setBulkCatId("");
		router.invalidate();
		setLoading(false);
	}

	async function handleCategoryChange(txId: string, catId: number | null) {
		await updateTransactionCategory({ data: { id: txId, categoryId: catId } });
		router.invalidate();
	}

	return (
		<div className="flex flex-col h-full">
			<TransactionFilters
				searchInput={searchInput}
				onSearchChange={handleSearchChange}
				showChart={showChart}
				showChartToggle={hasChartFilter}
				onToggleChart={() => setShowChart((v) => !v)}
				dateFrom={search.dateFrom}
				dateTo={search.dateTo}
				categoryId={search.categoryId}
				accountIds={search.accountIds}
				accounts={accounts}
				categories={categories}
				selected={selected}
				bulkCatId={bulkCatId}
				onBulkCatChange={setBulkCatId}
				onBulkApply={handleBulkCategorise}
				onBulkClear={() => setSelected(new Set())}
				bulkLoading={loading}
				onDateFromChange={(v) => updateSearch({ dateFrom: v })}
				onDateToChange={(v) => updateSearch({ dateTo: v })}
				onCategoryChange={(v) => updateSearch({ categoryId: v })}
				onAccountChange={(v) => updateSearch({ accountIds: v })}
			/>

			{showChart && hasChartFilter && (
				<TransactionChartPanel chartStats={chartStats} loading={chartLoading} />
			)}

			<div className="flex-1 overflow-auto">
				<Table>
					<TableHeader className="sticky top-0 bg-muted/80 backdrop-blur-sm">
						<TableRow>
							<TableHead className="w-10 px-3">
								<Checkbox
									checked={
										selected.size === transactions.length &&
										transactions.length > 0
									}
									onCheckedChange={() => toggleAll()}
								/>
							</TableHead>
							<SortableHead
								id="bookingDate"
								sortKey={sortKey}
								sortDir={sortDir}
								onSort={toggle}
							>
								Date
							</SortableHead>
							<SortableHead
								id="creditorName"
								sortKey={sortKey}
								sortDir={sortDir}
								onSort={toggle}
							>
								Payee
							</SortableHead>
							<TableHead className="hidden sm:table-cell">
								Description
							</TableHead>
							<SortableHead
								id="amount"
								sortKey={sortKey}
								sortDir={sortDir}
								onSort={toggle}
								className="text-right"
							>
								Amount
							</SortableHead>
							<TableHead>Category</TableHead>
						</TableRow>
					</TableHeader>
					<TableBody>
						{transactions.length === 0 ? (
							<TableRow>
								<TableCell
									colSpan={6}
									className="py-16 text-center text-muted-foreground"
								>
									No transactions found.
								</TableCell>
							</TableRow>
						) : (
							transactions.map((tx) => (
								<TableRow
									key={tx.id}
									tabIndex={0}
									className="cursor-pointer transition-colors hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
									onClick={() => openTransaction(tx.id)}
									onKeyDown={(e) => {
										if (e.key === "Enter" || e.key === " ") {
											e.preventDefault();
											openTransaction(tx.id);
										}
									}}
								>
									<TableCell
										className="px-3"
										onClick={(e) => e.stopPropagation()}
										onKeyDown={(e) => e.stopPropagation()}
									>
										<Checkbox
											checked={selected.has(tx.id)}
											onCheckedChange={() => toggleSelect(tx.id)}
										/>
									</TableCell>
									<TableCell className="whitespace-nowrap text-muted-foreground">
										{formatDate(tx.bookingDate)}
									</TableCell>
									<TableCell className="max-w-48 truncate font-medium">
										{tx.creditorName ?? tx.debtorName ?? tx.description ?? "—"}
									</TableCell>
									<TableCell className="hidden max-w-64 truncate text-muted-foreground sm:table-cell">
										{tx.description ?? "—"}
									</TableCell>
									<TableCell
										className={`whitespace-nowrap text-right font-medium tabular-nums ${tx.amount >= 0 ? "text-positive" : ""}`}
									>
										{formatCurrency(tx.amount, tx.currency)}
									</TableCell>
									<TableCell>
										<Select
											value={
												tx.categoryId ? String(tx.categoryId) : "uncategorised"
											}
											onValueChange={(v) =>
												handleCategoryChange(
													tx.id,
													v === "uncategorised" ? null : Number(v),
												)
											}
										>
											<SelectTrigger
												className="h-7 w-full border-0 bg-transparent px-2 shadow-none hover:bg-muted"
												onClick={(e) => e.stopPropagation()}
												onKeyDown={(e) => e.stopPropagation()}
											>
												<SelectValue>
													{tx.category ? (
														<span className="flex items-center gap-2">
															<CategoryDot category={tx.category} />
															{tx.category.name}
														</span>
													) : (
														"Uncategorised"
													)}
												</SelectValue>
											</SelectTrigger>
											<SelectContent>
												<SelectItem value="uncategorised">
													<span className="flex items-center gap-2">
														<CategoryDot category={null} />
														Uncategorised
													</span>
												</SelectItem>
												{categories.map((c) => (
													<SelectItem key={c.id} value={String(c.id)}>
														<span className="flex items-center gap-2">
															<CategoryDot category={c} />
															{c.name}
														</span>
													</SelectItem>
												))}
											</SelectContent>
										</Select>
									</TableCell>
								</TableRow>
							))
						)}
					</TableBody>
				</Table>
			</div>

			<div className="flex items-center justify-between border-t px-4 py-3">
				<p className="text-sm text-muted-foreground">
					{total} transaction{total !== 1 ? "s" : ""} · page {page} of{" "}
					{totalPages || 1}
				</p>
				<div className="flex gap-2">
					<Button
						variant="outline"
						size="icon"
						onClick={() => navigate({ search: { ...search, page: page - 1 } })}
						disabled={page <= 1}
					>
						<ChevronLeft className="h-4 w-4" />
					</Button>
					<Button
						variant="outline"
						size="icon"
						onClick={() => navigate({ search: { ...search, page: page + 1 } })}
						disabled={page >= totalPages}
					>
						<ChevronRight className="h-4 w-4" />
					</Button>
				</div>
			</div>
		</div>
	);
}
