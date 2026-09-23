import { BarChart2, Check, ListTree, Search, WandSparkles } from "lucide-react";
import { CategoryDot } from "@/components/rules/category-dot";
import { Button } from "@/components/ui/button";
import { DatePicker } from "@/components/ui/date-picker";
import { Input } from "@/components/ui/input";
import {
	Select,
	SelectContent,
	SelectGroup,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import type { getCategories } from "@/server/fn/categories";
import type { getAccounts } from "@/server/fn/insights";

type Category = Awaited<ReturnType<typeof getCategories>>[number];
type Account = Awaited<ReturnType<typeof getAccounts>>[number];

export function TransactionFilters({
	searchInput,
	onSearchChange,
	showChart,
	showChartToggle,
	onToggleChart,
	dateFrom,
	dateTo,
	categoryId,
	amountSign,
	accountIds,
	accounts,
	categories,
	selected,
	bulkCatId,
	onBulkCatChange,
	onBulkApply,
	onBulkClear,
	onBulkReviewed,
	onBulkRule,
	onBulkSplit,
	bulkLoading,
	onDateFromChange,
	onDateToChange,
	onCategoryChange,
	onAmountSignChange,
	onAccountChange,
}: {
	searchInput: string;
	onSearchChange: (v: string) => void;
	showChart: boolean;
	showChartToggle: boolean;
	onToggleChart: () => void;
	dateFrom?: string;
	dateTo?: string;
	categoryId?: number;
	amountSign?: "in" | "out";
	accountIds?: string[];
	accounts: Account[];
	categories: Category[];
	selected: Set<string>;
	bulkCatId: string;
	onBulkCatChange: (v: string) => void;
	onBulkApply: () => void;
	onBulkClear: () => void;
	onBulkReviewed: () => void;
	onBulkRule: () => void;
	onBulkSplit: () => void;
	bulkLoading: boolean;
	onDateFromChange: (v?: string) => void;
	onDateToChange: (v?: string) => void;
	onCategoryChange: (v?: number) => void;
	onAmountSignChange: (v?: "in" | "out") => void;
	onAccountChange: (v?: string[]) => void;
}) {
	return (
		<div className="flex flex-col gap-3 border-b p-3 sm:p-4">
			<div className="flex flex-wrap gap-2 sm:gap-3">
				<div className="relative flex-1 min-w-0 w-full sm:min-w-48 sm:w-auto flex gap-2">
					<div className="relative flex-1">
						<Search className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
						<Input
							type="text"
							value={searchInput}
							onChange={(e) => onSearchChange(e.target.value)}
							placeholder="Search transactions…"
							className="pl-9 w-full"
						/>
					</div>
					{showChartToggle && (
						<Button
							variant={showChart ? "secondary" : "outline"}
							size="icon"
							onClick={onToggleChart}
							title="Toggle chart view"
						>
							<BarChart2 />
						</Button>
					)}
				</div>
				<div className="flex gap-2 flex-wrap w-full sm:w-auto">
					<DatePicker
						value={dateFrom}
						onChange={onDateFromChange}
						placeholder="From date"
					/>
					<DatePicker
						value={dateTo}
						onChange={onDateToChange}
						placeholder="To date"
					/>
				</div>
				<div className="flex gap-2 flex-wrap w-full sm:w-auto">
					<Select
						value={amountSign ?? "all"}
						onValueChange={(v) =>
							onAmountSignChange(v === "in" || v === "out" ? v : undefined)
						}
					>
						<SelectTrigger className="flex-1 sm:flex-none sm:min-w-32">
							<SelectValue placeholder="All amounts" />
						</SelectTrigger>
						<SelectContent>
							<SelectGroup>
								<SelectItem value="all">All amounts</SelectItem>
								<SelectItem value="out">Money out</SelectItem>
								<SelectItem value="in">Money in</SelectItem>
							</SelectGroup>
						</SelectContent>
					</Select>
					<Select
						value={categoryId !== undefined ? String(categoryId) : "all"}
						onValueChange={(v) =>
							onCategoryChange(v && v !== "all" ? Number(v) : undefined)
						}
					>
						<SelectTrigger className="flex-1 sm:flex-none sm:min-w-36">
							<SelectValue placeholder="All categories">
								{categoryId === undefined
									? "All categories"
									: categoryId === -1
										? "Uncategorised"
										: (() => {
												const cat = categories.find((c) => c.id === categoryId);
												return cat ? (
													<span className="flex items-center gap-2">
														<CategoryDot category={cat} />
														{cat.name}
													</span>
												) : (
													"All categories"
												);
											})()}
							</SelectValue>
						</SelectTrigger>
						<SelectContent>
							<SelectGroup>
							<SelectItem value="all">All categories</SelectItem>
							<SelectItem value="-1">
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
							</SelectGroup>
						</SelectContent>
					</Select>
					{accounts.length > 1 && (
						<Select
							value={(accountIds ?? [])[0] ?? "all"}
							onValueChange={(v) =>
								onAccountChange(v && v !== "all" ? [v] : undefined)
							}
						>
							<SelectTrigger className="flex-1 sm:flex-none sm:min-w-36">
								<SelectValue placeholder="All accounts" />
							</SelectTrigger>
							<SelectContent>
								<SelectGroup>
								<SelectItem value="all">All accounts</SelectItem>
								{accounts.map((a) => (
									<SelectItem key={a.id} value={a.id}>
										{a.name ?? a.iban ?? a.id}
									</SelectItem>
								))}
								</SelectGroup>
							</SelectContent>
						</Select>
					)}
				</div>
			</div>

			{selected.size > 0 && (
				<div className="flex items-center gap-3 bg-muted/40 rounded-md px-3 py-2">
					<span className="text-sm font-medium">{selected.size} selected</span>
					<Select
						value={bulkCatId || "none"}
						onValueChange={(v) => onBulkCatChange(v && v !== "none" ? v : "")}
					>
						<SelectTrigger className="h-8 w-auto min-w-40 text-sm">
							<SelectValue placeholder="Assign category…" />
						</SelectTrigger>
					<SelectContent>
						<SelectGroup>
							<SelectItem value="none" disabled>
								Assign category…
							</SelectItem>
						{categories.map((c) => (
								<SelectItem key={c.id} value={String(c.id)}>
									<span className="flex items-center gap-2">
										<CategoryDot category={c} />
										{c.name}
									</span>
								</SelectItem>
						))}
						</SelectGroup>
					</SelectContent>
					</Select>
					<Button
						size="sm"
						onClick={onBulkApply}
						disabled={!bulkCatId || bulkLoading}
					>
						Apply
					</Button>
					<Button size="sm" variant="ghost" onClick={onBulkClear}>
						Clear
					</Button>
					<Button size="sm" variant="outline" onClick={onBulkRule} disabled={selected.size !== 1} title="Select one transaction to create a rule">
						<WandSparkles /> Create rule
					</Button>
					<Button size="sm" variant="outline" onClick={onBulkReviewed} disabled={bulkLoading}>
						<Check /> Mark reviewed
					</Button>
					<Button size="sm" variant="outline" onClick={onBulkSplit} disabled={selected.size !== 1} title="Select one transaction to split">
						<ListTree /> Split
					</Button>
				</div>
			)}
		</div>
	);
}
