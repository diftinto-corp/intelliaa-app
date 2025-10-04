'use client';

// ============================================================================
// Storage Selection Combobox Component
// Created: 2025-10-04 (INTEL-008)
// Description: Searchable dropdown for selecting document storages
// ============================================================================

import { useState } from 'react';
import { Check, ChevronsUpDown, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';

// ============================================================================
// Types
// ============================================================================

type AvailableStorage = {
  id: string;
  name: string;
  description: string | null;
  namespace: string;
};

interface StorageSelectionComboboxProps {
  availableStorages: AvailableStorage[];
  onSelect: (storageId: string) => void;
  disabled?: boolean;
  isLoading?: boolean;
}

// ============================================================================
// Component
// ============================================================================

export function StorageSelectionCombobox({
  availableStorages,
  onSelect,
  disabled = false,
  isLoading = false,
}: StorageSelectionComboboxProps) {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  const handleSelect = (currentValue: string) => {
    if (currentValue === value) {
      setValue('');
      setOpen(false);
      return;
    }

    setValue(currentValue);
    setOpen(false);
    onSelect(currentValue);

    // Reset after selection
    setValue('');
    setSearchQuery('');
  };

  const filteredStorages = availableStorages.filter((storage) =>
    storage.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          aria-label="Seleccionar almacenamiento"
          className="w-full justify-between"
          disabled={disabled || isLoading}
        >
          {isLoading ? (
            <span className="flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" />
              Cargando almacenamientos...
            </span>
          ) : availableStorages.length === 0 ? (
            <span className="text-muted-foreground">No hay almacenamientos disponibles</span>
          ) : (
            <span className="text-muted-foreground">Seleccionar almacenamiento...</span>
          )}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-full p-0" align="start">
        <Command shouldFilter={false}>
          <CommandInput
            placeholder="Buscar almacenamiento..."
            value={searchQuery}
            onValueChange={setSearchQuery}
          />
          <CommandList>
            <CommandEmpty>
              {searchQuery
                ? 'No se encontraron resultados'
                : 'No hay almacenamientos disponibles'}
            </CommandEmpty>
            <CommandGroup>
              {filteredStorages.map((storage) => (
                <CommandItem
                  key={storage.id}
                  value={storage.id}
                  onSelect={handleSelect}
                  className="cursor-pointer"
                >
                  <Check
                    className={cn(
                      'mr-2 h-4 w-4',
                      value === storage.id ? 'opacity-100' : 'opacity-0'
                    )}
                  />
                  <div className="flex flex-col gap-1">
                    <span className="font-medium">{storage.name}</span>
                    {storage.description && (
                      <span className="text-sm text-muted-foreground line-clamp-1">
                        {storage.description}
                      </span>
                    )}
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
