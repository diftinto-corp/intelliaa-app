import { Input } from "@/components/ui/input";
import { SubmitButton } from "@/components/ui/submit-button";
import { createTeam } from "@/lib/actions/teams";
import { Label } from "../ui/label";

export default function NewTeamForm({ setShowNewTeamDialog }: any) {
  return (
    <form className='animate-in flex-1 flex flex-col w-full justify-center gap-y-6 text-muted-foreground'>
      <div className='flex flex-col gap-y-2'>
        <Label htmlFor='email'>Nombre de la organización</Label>
        <Input name='name' placeholder='Mi organización' required />
      </div>
      <div className='flex flex-col gap-y-2'>
        <Label htmlFor='password'>Identificador</Label>
        <div className='flex items-center gap-x-2'>
          <span className='text-sm text-muted-foreground whitespace-nowrap grow'>
            https://tu-organizacion.com/
          </span>
          <Input name='slug' placeholder='mi-organización' required />
        </div>
      </div>
      <SubmitButton
        formAction={createTeam}
        pendingText='Creando...'
        setOpenModal={setShowNewTeamDialog}>
        Crear organización
      </SubmitButton>
    </form>
  );
}
