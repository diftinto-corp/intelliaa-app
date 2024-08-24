import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Check, ChevronsUpDown, Edit2, ShoppingCart } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import {
  listActiveNumbers,
  listAvailableNumbers,
  listVoiceCountry,
} from "@/lib/actions/intelliaa/twilio";
import {
  GetAssistant,
  purchaseNumber,
} from "@/lib/actions/intelliaa/assistants";
import { getAccount } from "@/lib/actions/intelliaa/accounts";
import ModalAssignAssistantToNumber from "./ModalAssignAssistantToNumber";
import { ScrollBar, ScrollArea } from "@/components/ui/scroll-area";
import Page from "twilio/lib/base/Page";
import { createClient } from "@/lib/supabase/client";
import { usePathname } from "next/navigation";
import { getAccountBySlug } from "@/lib/actions/accounts";

interface Pais {
  country: string;
  isoCountry: string;
}

interface NumberDetails {
  number: string;
  price: string;
}

interface ListAvailableNumbersResult {
  numbers: NumberDetails[];
  totalPages: number;
}

interface ActiveNumber {
  number: string;
  country: string;
  type: string;
  id_assistant: string;
  name_assistant: string;
  id_number_vapi: string;
}

export function TabsNumber() {
  const pathname = usePathname();
  const accountSlug = pathname.split("/")[1];

  const [open, setOpen] = useState(false);
  const [selectedCountry, setSelectedCountry] = useState<string>("US");
  const [paises, setPaises] = useState<Pais[]>([]);
  const [numbers, setNumbers] = useState<NumberDetails[]>([]);
  const [type, setType] = useState<"local" | "toll free">("local");
  const [loading, setLoading] = useState<boolean>(false);
  const [countriesLoading, setCountriesLoading] = useState<boolean>(false);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [totalPages, setTotalPages] = useState<number>(1);
  const [activeNumbers, setActiveNumbers] = useState<ActiveNumber[]>([]);
  const [activeLoading, setActiveLoading] = useState<boolean>(false);

  const supabase = createClient();

  useEffect(() => {
    const fetchNumbers = async () => {
      setLoading(true);
      try {
        const result: ListAvailableNumbersResult = await listAvailableNumbers(
          type,
          selectedCountry,
          currentPage
        );
        setNumbers(result.numbers);
        setTotalPages(result.totalPages);
      } catch (error) {
        console.error("Error fetching numbers:", error);
        setNumbers([]);
      } finally {
        setLoading(false);
      }
    };

    fetchNumbers();
  }, [type, selectedCountry, currentPage]);

  useEffect(() => {
    const fetchCountries = async () => {
      setCountriesLoading(true);
      setActiveLoading(true);
      const team_account = await getAccountBySlug(null, accountSlug);
      const account_id = team_account.account_id;
      try {
        const result = await listVoiceCountry();
        const activeNumbers = await purchaseNumber(account_id);
        setActiveNumbers(activeNumbers?.data || []);

        setPaises(result);
      } catch (error) {
        console.error("Error fetching countries:", error);
        setPaises([]);
      } finally {
        setCountriesLoading(false);
        setActiveLoading(false);
      }
    };

    fetchCountries();
  }, []);

  useEffect(() => {
    const channel = supabase
      .channel("actve_numbers_update")
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "active_numbers",
        },
        (payload: any) => {
          setActiveNumbers((currentNumbers) => {
            const index = currentNumbers.findIndex(
              (number) => number.number === payload.new.number
            );
            if (index !== -1) {
              return [
                ...currentNumbers.slice(0, index),
                payload.new,
                ...currentNumbers.slice(index + 1),
              ];
            } else {
              return [...currentNumbers, payload.new];
            }
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [activeNumbers]);

  const handleCountrySelect = (isoCountry: string) => {
    setSelectedCountry(isoCountry);
    setOpen(false);
  };

  const handlePageChange = (page: number) => {
    if (page > 0 && page <= totalPages) {
      setCurrentPage(page);
    }
  };

  return (
    <Tabs defaultValue='buy_number' className='w-full'>
      <TabsList className='grid w-full grid-cols-2'>
        <TabsTrigger
          className='data-[state=active]:bg-[#182426] data-[state=active]:text-primary'
          value='buy_number'>
          Comprar números
        </TabsTrigger>
        <TabsTrigger
          className='data-[state=active]:bg-[#182426] data-[state=active]:text-primary'
          value='active_number'>
          Números activos
        </TabsTrigger>
      </TabsList>
      <TabsContent value='buy_number'>
        <div className='text-muted-foreground'>
          <div className='flex w-full gap-4 mb-5 mt-5'>
            <div>
              <Popover open={open} onOpenChange={setOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant='outline'
                    role='combobox'
                    aria-expanded={open}
                    className='w-[200px] justify-between'>
                    {countriesLoading
                      ? "Cargando..."
                      : paises.find(
                          (pais) => pais.isoCountry === selectedCountry
                        )?.country || "Seleccione un país"}
                    <ChevronsUpDown className='ml-2 h-4 w-4 shrink-0 opacity-50 text-muted-foreground' />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className='w-[200px] p-0 text-muted-foreground'>
                  <Command>
                    <CommandInput
                      className='text-muted-foreground'
                      placeholder='Buscar País...'
                    />
                    <CommandList>
                      {countriesLoading ? (
                        <CommandEmpty className='text-muted-foreground'>
                          Cargando países...
                        </CommandEmpty>
                      ) : paises.length === 0 ? (
                        <CommandEmpty className='text-muted-foreground'>
                          No se encontró ningún país
                        </CommandEmpty>
                      ) : (
                        <CommandGroup>
                          {paises.map((pais) => (
                            <CommandItem
                              className='text-muted-foreground'
                              key={pais.isoCountry}
                              value={pais.isoCountry}
                              onSelect={() =>
                                handleCountrySelect(pais.isoCountry)
                              }>
                              <Check
                                className={cn(
                                  "mr-2 h-4 w-4",
                                  selectedCountry === pais.isoCountry
                                    ? "opacity-100"
                                    : "opacity-0"
                                )}
                              />
                              {pais.country}
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      )}
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>
            <div className='flex gap-4 w-full'>
              <RadioGroup
                value={type}
                onValueChange={(value: "local" | "toll free") => setType(value)}
                className='flex mt-2'>
                <div className='flex items-center space-x-2'>
                  <RadioGroupItem value='local' id='r1' />
                  <Label htmlFor='r1'>Local</Label>
                </div>
                <div className='flex items-center space-x-2'>
                  <RadioGroupItem value='toll free' id='r2' />
                  <Label htmlFor='r2'>Toll Free</Label>
                </div>
              </RadioGroup>
            </div>
          </div>
          <div className=''>
            {loading ? (
              <div>Cargando números...</div>
            ) : numbers.length === 0 ? (
              <div>No se encontraron números</div>
            ) : (
              <Table>
                <TableCaption>
                  <Pagination>
                    <PaginationContent>
                      <PaginationItem>
                        <PaginationPrevious
                          href='#'
                          onClick={(e) => {
                            e.preventDefault();
                            handlePageChange(currentPage - 1);
                          }}
                          isActive={currentPage === 1}
                        />
                      </PaginationItem>
                      {Array.from({ length: totalPages }, (_, index) => (
                        <PaginationItem key={index + 1}>
                          <PaginationLink
                            href='#'
                            onClick={(e) => {
                              e.preventDefault();
                              handlePageChange(index + 1);
                            }}
                            className={
                              currentPage === index + 1 ? "active" : ""
                            }>
                            {index + 1}
                          </PaginationLink>
                        </PaginationItem>
                      ))}
                      <PaginationItem>
                        <PaginationNext
                          href='#'
                          onClick={(e) => {
                            e.preventDefault();
                            handlePageChange(currentPage + 1);
                          }}
                          isActive={currentPage === totalPages}
                        />
                      </PaginationItem>
                    </PaginationContent>
                  </Pagination>
                </TableCaption>
                <TableHeader>
                  <TableRow className='bg-foreground'>
                    <TableHead className='w-[20%] text-primary'>
                      Número
                    </TableHead>
                    <TableHead className='w-[20%] text-primary'>País</TableHead>
                    <TableHead className='w-[20%] text-primary'>Tipo</TableHead>
                    <TableHead className='w-[20%] text-primary'>
                      Precio
                    </TableHead>
                    <TableHead className='w-[20%] text-primary text-right'></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {numbers.map((number) => (
                    <TableRow key={number.number}>
                      <TableCell className='font-medium'>
                        {number.number}
                      </TableCell>
                      <TableCell>{selectedCountry}</TableCell>
                      <TableCell>{type}</TableCell>
                      <TableCell>{number.price}</TableCell>
                      <TableCell className='text-right'>
                        <Button
                          className='bg-primary text-white'
                          size='sm'
                          onClick={() => console.log("Comprar número")}>
                          <ShoppingCart className='h-4 w-4 mr-2' />
                          Comprar
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
                <TableFooter></TableFooter>
              </Table>
            )}
          </div>
        </div>
      </TabsContent>
      <TabsContent value='active_number'>
        <Card>
          <CardHeader>
            <CardTitle>Números Activos</CardTitle>
            <CardDescription>
              Aquí puedes ver los números telefónicos que tienes activos en tu
              cuenta.
            </CardDescription>
          </CardHeader>
          <CardContent className='space-y-2'>
            {activeLoading ? (
              <div>Cargando números activos...</div>
            ) : activeNumbers.length === 0 ? (
              <div>No tienes números activos</div>
            ) : (
              <Table className='overflow-hidden'>
                <TableHeader>
                  <TableRow className='bg-foreground'>
                    <TableHead className='w-[33%] text-primary'>
                      Número
                    </TableHead>
                    <TableHead className='w-[33%] text-primary'>País</TableHead>
                    <TableHead className='w-[33%] text-primary'>Tipo</TableHead>
                    <TableHead className='w-[33%] text-primary'>
                      Asistente
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {activeNumbers?.map((number) => (
                    <TableRow key={number.number}>
                      <TableCell>{number.number}</TableCell>
                      <TableCell>{number.country}</TableCell>
                      <TableCell>{number.type}</TableCell>
                      <TableCell className='text-right'>
                        <ModalAssignAssistantToNumber number={number} />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
                <TableFooter></TableFooter>
              </Table>
            )}
          </CardContent>
          <CardFooter></CardFooter>
        </Card>
      </TabsContent>
    </Tabs>
  );
}
