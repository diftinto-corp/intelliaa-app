"use client";

import { useEffect, SetStateAction, useState, Dispatch } from "react";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { getDocumentsByDocumentStorageIdWs } from "@/lib/actions/intelliaa/documents";
import { getAccountBySlug } from "@/lib/actions/accounts";
import { usePathname } from "next/navigation";

type DocumentStorage = {
  id: string;
  name: string; // IDs combinados de documentos (PDF y TXT)
};

export default function SelectorDs({
  setIsChangeOptions,
  documentStorageId,
  setDocumentStorageId,
}: {
  setIsChangeOptions: (isChangeOptions: boolean) => void;
  documentStorageId: string;
  setDocumentStorageId: Dispatch<SetStateAction<string>>;
}) {
  const pathname = usePathname();
  const accountSlug = pathname.split("/")[1];

  const [storages, setStorages] = useState<DocumentStorage[]>([]);

  console.log(storages);

  useEffect(() => {
    const fetchStorages = async () => {
      try {
        const teamAccount = await getAccountBySlug(null, accountSlug);
        const accountId = teamAccount.account_id;
        const fetchedStorages = await getDocumentsByDocumentStorageIdWs(
          accountId
        );
        if (Array.isArray(fetchedStorages)) {
          setStorages(fetchedStorages);
        } else {
          console.error("Fetched storages is not an array:", fetchedStorages);
        }
      } catch (error) {
        console.error("Error fetching storages:", error);
      }
    };
    fetchStorages();
  }, [accountSlug, documentStorageId]);

  const handleChange = (value: string) => {
    setDocumentStorageId(value);
    setIsChangeOptions(true);
  };

  return (
    <Select onValueChange={handleChange} value={documentStorageId}>
      <SelectTrigger className='w-[180px]'>
        <SelectValue placeholder='Select a document storage' />
      </SelectTrigger>
      <SelectContent>
        <SelectGroup>
          <SelectLabel>Document storage</SelectLabel>
          {storages.map((storage) => (
            <SelectItem key={storage.id} value={storage.id}>
              {storage.name}
            </SelectItem>
          ))}
        </SelectGroup>
      </SelectContent>
    </Select>
  );
}
