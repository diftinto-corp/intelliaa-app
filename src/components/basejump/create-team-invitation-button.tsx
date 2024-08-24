"use client";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import NewInvitationForm from "./new-invitation-form";
import { useState } from "react";

type Props = {
  accountId: string;
  account: any;
};

export default function CreateTeamInvitationButton({
  accountId,
  account,
}: Props) {
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant='outline'>Crear nueva invitación</Button>
      </DialogTrigger>
      <DialogContent className='sm:max-w-[425px]'>
        <DialogHeader>
          <DialogTitle className='text-primary'>
            Crear nueva invitación
          </DialogTitle>
          <DialogDescription>
            Invita a un nuevo miembro a tu organización.
          </DialogDescription>
        </DialogHeader>
        <NewInvitationForm
          accountId={accountId}
          account={account}
          setOpen={setOpen}
        />
      </DialogContent>
    </Dialog>
  );
}
