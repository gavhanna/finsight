import { BarChart2, Search } from "lucide-react";
import { CategoryDot } from "@/components/rules/category-dot";
import { Button } from "@/components/ui/button";
import { DatePicker } from "@/components/ui/date-picker";
import { Input } from "@/components/ui/input";
import {
	Select,
	SelectContent,
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
	accountIds,
	accounts,
	categories,
	selected,
	bulkCatId,
	onBulkCatChange,
	onBulkApply,
	onBulkClear,
	bulkLoading,
	onDateFromChange,
	onDateToChange,
	onCategoryChange,
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
	accountIds?: string[];
	accounts: Account[];
	categories: Category[];
	selected: Set<string>;
	bulkCatId: string;
	onBulkCatChange: (v: string) => void;
	onBulkApply: () => void;
	onBulkClear: () => void;
	bulkLoading: boolean;
	onDateFromChange: (v?: string) => void;
	onDateToChange: (v?: string) => void;
	onCategoryChange: (v?: number) => void;
	onAccountChange: (v?: string[]) => void;
}) {
	return (
		<div className="border-b p-3 sm:p-4 space-y-3">
			<div className="flex flex-wrap gap-2 sm:gap-3">
				<div className="relative flex-1 min-w-0 w-full sm:min-w-48 sm:w-auto flex gap-2">
					<div className="relative flex-1">
						<Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
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
							<BarChart2 className="h-4 w-4" />
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
								<SelectItem value="all">All accounts</SelectItem>
								{accounts.map((a) => (
									<SelectItem key={a.id} value={a.id}>
										{a.name ?? a.iban ?? a.id}
									</SelectItem>
								))}
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
				</div>
			)}
		</div>
	);
}
