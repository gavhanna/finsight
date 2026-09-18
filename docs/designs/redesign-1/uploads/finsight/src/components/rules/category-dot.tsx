import { cn } from "@/lib/utils";

type CategoryLike = { color?: string | null } | null;

export function CategoryDot({
	category,
	size = "sm",
}: {
	category: CategoryLike;
	size?: "sm" | "xs";
}) {
	return (
		<span
			className={cn(
				"rounded-full flex-shrink-0 inline-block",
				size === "xs" ? "size-1.5" : "size-2",
			)}
			style={{ backgroundColor: category?.color ?? "#888" }}
		/>
	);
}
