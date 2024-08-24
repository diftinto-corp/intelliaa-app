"use client";
import { Label } from "../ui/label";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import { createInvitation } from "@/lib/actions/invitations";
import { Input } from "../ui/input";
import { Button } from "../ui/button";
import { useState } from "react";

type Props = {
  accountId: string;
  account: any;
  setOpen: (open: boolean) => void;
};

const memberOptions = [
  { label: "Owner", value: "owner" },
  { label: "Member", value: "member" },
];

export default function NewInvitationForm({
  accountId,
  account,
  setOpen,
}: Props) {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    email: "",
    accountRole: "member",
  });
  const [message, setMessage] = useState<string | null>(null);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  const handleInvitation = async () => {
    setLoading(true);

    const data = new FormData();
    data.append("accountId", accountId);
    data.append("invitationType", "one_time");
    data.append("email", formData.email);
    data.append("accountRole", formData.accountRole);
    data.append("accountName", account.name);

    const response = await createInvitation(null, data);
    setLoading(false);

    if (response.token) {
      setMessage("Invitación enviada correctamente");
      setTimeout(() => {
        setOpen(false); // Cierra el modal si la invitación se envía correctamente
      }, 1000);
    } else {
      setMessage(response.message); // Muestra un mensaje de error si algo sale mal
      alert(response.message); // Muestra un mensaje de error si algo sale mal
    }
  };

  return (
    <form
      className='animate-in flex-1 flex flex-col w-full justify-center gap-y-6 text-muted-foreground'
      onSubmit={(e) => {
        e.preventDefault();
        handleInvitation();
      }}>
      <input type='hidden' name='accountId' value={accountId} />
      <input type='hidden' name='invitationType' value={"one_time"} />
      <Input
        type='email'
        name='email'
        placeholder='Correo electrónico'
        required
        onChange={handleChange}
      />
      <div className='flex flex-col gap-y-2'>
        <Label htmlFor='accountRole'>Role de la organización</Label>
        <Select
          name='accountRole'
          value={formData.accountRole}
          onValueChange={(value) =>
            setFormData({ ...formData, accountRole: value })
          }>
          <SelectTrigger>
            <SelectValue placeholder='Tipo de miembro' />
          </SelectTrigger>
          <SelectContent>
            {memberOptions.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      {message && <p>{message}</p>}
      <Button type='submit' className='bg-primary' disabled={loading}>
        {loading ? "Enviando..." : "Enviar"}
      </Button>
    </form>
  );
}
