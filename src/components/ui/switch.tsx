import * as React from "react";

import { cn } from "@/utils/utils";

function Switch({ className, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type="checkbox"
      data-slot="switch"
      className={cn(
        "border-input data-[state=checked]:bg-primary data-[state=checked]:border-primary relative inline-flex h-5 w-9 shrink-0 cursor-pointer appearance-none items-center rounded-full border bg-muted transition-colors",
        "focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]",
        "disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50",
        "after:content-[''] after:absolute after:left-0.5 after:h-4 after:w-4 after:rounded-full after:bg-background after:transition-transform after:shadow",
        "checked:after:translate-x-4 checked:bg-primary checked:border-primary",
        className,
      )}
      {...props}
    />
  );
}

export { Switch };
