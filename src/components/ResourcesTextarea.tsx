import * as React from "react";

import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/utils/utils";

const urlRegex = /(https?:\/\/|www\.)[^\s]+/g;

type ResourcesTextareaProps = React.ComponentProps<typeof Textarea>;

type HighlightPart = {
	text: string;
	isLink: boolean;
};

function getHighlightParts(value: string): HighlightPart[] {
	if (!value) return [];

	const parts: HighlightPart[] = [];
	let lastIndex = 0;

	for (const match of value.matchAll(urlRegex)) {
		const matchText = match[0];
		const matchIndex = match.index ?? 0;

		if (matchIndex > lastIndex) {
			parts.push({
				text: value.slice(lastIndex, matchIndex),
				isLink: false,
			});
		}

		parts.push({ text: matchText, isLink: true });
		lastIndex = matchIndex + matchText.length;
	}

	if (lastIndex < value.length) {
		parts.push({ text: value.slice(lastIndex), isLink: false });
	}

	return parts;
}

function ResourcesTextarea({
	className,
	value,
	...props
}: ResourcesTextareaProps) {
	const textValue = typeof value === "string" ? value : "";
	const highlightParts = getHighlightParts(textValue);

	return (
		<div className="relative">
			{textValue.length > 0 && (
				<div className="pointer-events-none absolute inset-0 rounded-md">
					<div className="min-h-full whitespace-pre-wrap px-3 py-2 text-base leading-6 text-foreground md:text-sm md:leading-5">
						{highlightParts.map((part, index) => (
							<span
								key={`${part.text}-${index}`}
								className={cn(
									part.isLink &&
										"underline underline-offset-2 decoration-primary/40",
								)}
							>
								{part.text}
							</span>
						))}
					</div>
				</div>
			)}
      <Textarea
        value={value}
        className={cn(
          "relative bg-transparent text-transparent caret-foreground placeholder:text-muted-foreground",
          className,
        )}
        {...props}
      />
		</div>
	);
}

export { ResourcesTextarea };
