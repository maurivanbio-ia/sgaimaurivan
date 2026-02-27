import * as React from "react"
import { cn } from "@/lib/utils"
import { normalizeInput } from "@/lib/textNormalization"

export interface TextareaProps extends React.ComponentProps<"textarea"> {
  noNormalize?: boolean;
}

const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, noNormalize, onChange, ...props }, ref) => {
    const normalize = !noNormalize;

    const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      if (normalize && e.target.value) {
        const cursorPos = e.target.selectionStart;
        e.target.value = normalizeInput(e.target.value);
        try {
          e.target.setSelectionRange(cursorPos, cursorPos);
        } catch {}
      }
      onChange?.(e);
    };

    return (
      <textarea
        className={cn(
          "flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-base ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
          normalize && "uppercase tracking-wide",
          className
        )}
        ref={ref}
        onChange={handleChange}
        {...props}
      />
    )
  }
)
Textarea.displayName = "Textarea"

export { Textarea }
