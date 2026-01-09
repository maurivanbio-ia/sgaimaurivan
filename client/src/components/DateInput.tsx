import { useState, useEffect, useRef } from "react";
import { CalendarIcon, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";
import { format, parse, isValid } from "date-fns";
import { ptBR } from "date-fns/locale";

interface DateInputProps {
  value: Date | null | undefined;
  onChange: (date: Date | null | undefined) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  "data-testid"?: string;
}

export function DateInput({
  value,
  onChange,
  placeholder = "DD/MM/AAAA",
  disabled = false,
  className,
  "data-testid": dataTestId,
}: DateInputProps) {
  const [inputValue, setInputValue] = useState("");
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (value && isValid(value)) {
      setInputValue(format(value, "dd/MM/yyyy", { locale: ptBR }));
    } else {
      setInputValue("");
    }
  }, [value]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let newValue = e.target.value;
    
    const digitsOnly = newValue.replace(/\D/g, "");
    
    if (digitsOnly.length <= 8) {
      let formatted = "";
      for (let i = 0; i < digitsOnly.length; i++) {
        if (i === 2 || i === 4) formatted += "/";
        formatted += digitsOnly[i];
      }
      newValue = formatted;
    }
    
    setInputValue(newValue);

    if (digitsOnly.length === 8) {
      const parsed = parse(newValue, "dd/MM/yyyy", new Date(), { locale: ptBR });
      if (isValid(parsed)) {
        // Usar a data exatamente como digitada, sem conversão de fuso horário
        onChange(parsed);
      }
    } else if (digitsOnly.length === 0) {
      onChange(undefined);
    }
  };

  const handleCalendarSelect = (date: Date | undefined) => {
    if (date) {
      // Usar a data exatamente como selecionada, sem conversão de fuso horário
      onChange(date);
    } else {
      onChange(date);
    }
    setIsCalendarOpen(false);
  };

  const handleClear = () => {
    setInputValue("");
    onChange(undefined);
  };

  return (
    <div className={cn("relative flex items-center", className)}>
      <Input
        ref={inputRef}
        type="text"
        value={inputValue}
        onChange={handleInputChange}
        placeholder={placeholder}
        disabled={disabled}
        className="pr-16"
        data-testid={dataTestId}
      />
      <div className="absolute right-1 flex items-center gap-1">
        {inputValue && (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={handleClear}
            disabled={disabled}
            data-testid={`${dataTestId}-clear`}
          >
            <X className="h-4 w-4 text-muted-foreground" />
          </Button>
        )}
        <Popover open={isCalendarOpen} onOpenChange={setIsCalendarOpen}>
          <PopoverTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              disabled={disabled}
              data-testid={`${dataTestId}-calendar`}
            >
              <CalendarIcon className="h-4 w-4 text-muted-foreground" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="end">
            <CalendarComponent
              mode="single"
              selected={value ?? undefined}
              onSelect={handleCalendarSelect}
              initialFocus
            />
          </PopoverContent>
        </Popover>
      </div>
    </div>
  );
}
