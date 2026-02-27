import * as React from "react"
import { cn } from "@/lib/utils"
import { normalizeInput, shouldNormalizeField } from "@/lib/textNormalization"

export interface InputProps extends React.ComponentProps<"input"> {
  noNormalize?: boolean;
}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, noNormalize, onChange, name, id, ...props }, ref) => {
    const normalize = !noNormalize && shouldNormalizeField(type, name, id);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      if (normalize && e.target.value) {
        e.target.value = normalizeInput(e.target.value);
      }
      onChange?.(e);
    };

    return (
      <input
        type={type}
        name={name}
        id={id}
        className={cn(
          "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-base ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
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
Input.displayName = "Input"

export { Input }
