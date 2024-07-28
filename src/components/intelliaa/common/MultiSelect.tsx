"use client";

import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { CheckIcon, ChevronDown, PlusCircle, XCircle } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";

import { cn } from "@/lib/utils";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";

const multiSelectVariants = cva(
  "m-1 transition ease-in-out delay-150 hover:-translate-y-1 hover:scale-110 duration-300",
  {
    variants: {
      variant: {
        default:
          "border-foreground/10 text-foreground bg-card hover:bg-card/80",
        secondary:
          "border-foreground/10 bg-secondary text-secondary-foreground hover:bg-secondary/80",
        destructive:
          "border-transparent bg-destructive text-destructive-foreground hover:bg-destructive/80",
        inverted: "inverted",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
);

interface Option {
  name: string;
  s3_key: string;
  id_document: string;
  namespace: string;
}

interface MultiSelectProps extends VariantProps<typeof multiSelectVariants> {
  options: Option[];
  onValueChange: (value: Option[]) => void;
  defaultValue: Option[];
  placeholder?: string;
  animation?: number;
  maxCount?: number;
  setIsChangeOptions: any;
  asChild?: boolean;
  className?: string;
}

export const MultiSelect = React.forwardRef<
  HTMLButtonElement,
  MultiSelectProps & React.HTMLAttributes<HTMLButtonElement>
>(
  (
    {
      options,
      onValueChange,
      variant,
      defaultValue = [],
      placeholder = "Seleccionar Documentos",
      animation = 0,
      maxCount = 3,
      setIsChangeOptions,
      asChild = false,
      className,
      ...props
    },
    ref
  ) => {
    const pathname = usePathname();

    const path = pathname.split("/")[1];

    const router = useRouter();
    const [selectedValues, setSelectedValues] =
      React.useState<Option[]>(defaultValue);
    const [isPopoverOpen, setIsPopoverOpen] = React.useState(false);
    const [isAnimating, setIsAnimating] = React.useState(false);

    React.useEffect(() => {
      if (JSON.stringify(selectedValues) !== JSON.stringify(defaultValue)) {
        setSelectedValues(defaultValue);
      }
    }, [defaultValue]);

    const handleInputKeyDown = (
      event: React.KeyboardEvent<HTMLInputElement>
    ) => {
      if (event.key === "Enter") {
        setIsPopoverOpen(true);
      } else if (event.key === "Backspace" && !event.currentTarget.value) {
        const newSelectedValues = [...selectedValues];
        newSelectedValues.pop();
        setSelectedValues(newSelectedValues);
        onValueChange(newSelectedValues);
      }
    };

    const toggleOption = (option: Option) => {
      const newSelectedValues = selectedValues.some(
        (value) => value.s3_key === option.s3_key
      )
        ? selectedValues.filter((value) => value.s3_key !== option.s3_key)
        : [...selectedValues, { ...option, id_document: option.id_document }];
      setSelectedValues(newSelectedValues);
      onValueChange(newSelectedValues);
      setIsChangeOptions(true);
    };

    const handleClear = () => {
      setSelectedValues([]);
      onValueChange([]);
    };

    const handleTogglePopover = () => {
      setIsPopoverOpen((prev) => !prev);
    };

    const clearExtraOptions = () => {
      const newSelectedValues = selectedValues.slice(0, maxCount);
      setSelectedValues(newSelectedValues);
      onValueChange(newSelectedValues);
    };

    const handleAddDocument = () => {
      router.push(`/${path}/documents`); // Redirige a la página de agregar documento
    };

    return (
      <Popover open={isPopoverOpen} onOpenChange={setIsPopoverOpen}>
        <PopoverTrigger asChild>
          <Button
            ref={ref}
            {...props}
            onClick={handleTogglePopover}
            className={cn(
              "flex w-full p-1 rounded-md border min-h-10 h-auto items-center justify-between bg-inherit hover:bg-inherit",
              className
            )}>
            {selectedValues.length > 0 ? (
              <div className='flex justify-between items-center w-full'>
                <div className='flex flex-wrap items-center'>
                  {selectedValues.slice(0, maxCount).map((value) => {
                    const option = options.find(
                      (o) => o.s3_key === value.s3_key
                    );
                    return (
                      <Badge
                        key={value.s3_key}
                        className={cn(
                          isAnimating ? "animate-bounce" : "",
                          multiSelectVariants({ variant, className })
                        )}
                        style={{ animationDuration: `${animation}s` }}>
                        {option?.name}
                        <XCircle
                          className='ml-2 h-4 w-4 cursor-pointer'
                          onClick={(event) => {
                            event.stopPropagation();
                            toggleOption(option!);
                          }}
                        />
                      </Badge>
                    );
                  })}
                  {selectedValues.length > maxCount && (
                    <Badge
                      className={cn(
                        "bg-transparent text-foreground border-foreground/1 hover:bg-transparent",
                        isAnimating ? "animate-bounce" : "",
                        multiSelectVariants({ variant, className })
                      )}
                      style={{ animationDuration: `${animation}s` }}>
                      {`+ ${selectedValues.length - maxCount} more`}
                      <XCircle
                        className='ml-2 h-4 w-4 cursor-pointer'
                        onClick={(event) => {
                          event.stopPropagation();
                          clearExtraOptions();
                        }}
                      />
                    </Badge>
                  )}
                </div>
                <div className='flex items-center justify-between'>
                  <XCircle
                    className='h-4 mx-2 cursor-pointer text-muted-foreground'
                    onClick={(event) => {
                      event.stopPropagation();
                      handleClear();
                    }}
                  />
                  <Separator
                    orientation='vertical'
                    className='flex min-h-6 h-full'
                  />
                  <ChevronDown className='h-4 mx-2 cursor-pointer text-muted-foreground' />
                </div>
              </div>
            ) : (
              <div className='flex items-center justify-between w-full mx-auto'>
                <span className='text-sm text-muted-foreground mx-3'>
                  {placeholder}
                </span>
                <ChevronDown className='h-4 cursor-pointer text-muted-foreground mx-2' />
              </div>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent
          className='w-[200px] p-0'
          align='start'
          onEscapeKeyDown={() => setIsPopoverOpen(false)}>
          <Command>
            <CommandInput
              placeholder='Buscar...'
              onKeyDown={handleInputKeyDown}
            />
            <CommandList>
              <CommandEmpty>No hay resultados.</CommandEmpty>
              <CommandGroup>
                {options.map((option) => {
                  const isSelected = selectedValues.some(
                    (value) => value.s3_key === option.s3_key
                  );
                  return (
                    <CommandItem
                      key={option.s3_key}
                      onSelect={() => toggleOption(option)}
                      style={{ pointerEvents: "auto", opacity: 1 }}
                      className='cursor-pointer text-muted-foreground'>
                      <div
                        className={cn(
                          "mr-2 flex h-4 w-4 items-center justify-center rounded-sm border border-primary",
                          isSelected
                            ? "bg-primary text-primary-foreground"
                            : "opacity-50 [&_svg]:invisible"
                        )}>
                        <CheckIcon className='h-4 w-4' />
                      </div>
                      <span>{option.name}</span>
                    </CommandItem>
                  );
                })}
              </CommandGroup>
              <CommandSeparator />
              <CommandGroup>
                <div className='flex items-center justify-between'>
                  <CommandItem
                    onSelect={handleAddDocument}
                    style={{ pointerEvents: "auto", opacity: 1 }}
                    className='flex-1 justify-center cursor-pointer text-muted-foreground'>
                    <PlusCircle className='h-4 w-4 mr-2' />
                    Agregar Documento
                  </CommandItem>
                </div>
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    );
  }
);

MultiSelect.displayName = "MultiSelect";
