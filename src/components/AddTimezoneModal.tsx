import { useActionState, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { SearchableSelect } from '@/components/SearchableSelect';
import { COMMON_ZONES } from '@/utils/constants';
import type { Zone } from '@/types';

interface Props {
  open: boolean;
  onClose: () => void;
  onAdd: (zone: Zone) => void;
}

interface FormState {
  error: string | null;
}

export function AddTimezoneModal({ open, onClose, onAdd }: Props) {
  const [selectedTz, setSelectedTz] = useState('');
  const [person, setPerson] = useState('');

  // React 19: useActionState manages form submission state
  const [formState, submitAction, isPending] = useActionState(
    async (_prev: FormState, formData: FormData): Promise<FormState> => {
      const tz = formData.get('tz') as string;
      const personName = (formData.get('person') as string).trim();

      if (!tz) return { error: 'Please select a timezone.' };

      const match = COMMON_ZONES.flatMap((g) => g.zones).find((z) => z.tz === tz);

      // Allow custom IANA identifiers not in the curated list — validate via Intl
      if (!match) {
        try {
          new Intl.DateTimeFormat('en', { timeZone: tz });
        } catch {
          return { error: 'Invalid timezone identifier. Try e.g. America/Indiana/Indianapolis.' };
        }
      }

      const flag = match?.flag ?? '🌐';
      const label = match?.label ?? tz.split('/').pop()?.replace(/_/g, ' ') ?? tz;

      const zone: Zone = {
        id: crypto.randomUUID(),
        tz,
        label: personName || label,
        flag,
        person: personName,
      };

      onAdd(zone);
      handleClose();
      return { error: null };
    },
    { error: null }
  );

  function handleClose() {
    setSelectedTz('');
    setPerson('');
    onClose();
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && handleClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add a timezone</DialogTitle>
          <DialogDescription>
            Track a new location on your timeline.
          </DialogDescription>
        </DialogHeader>

        <form action={submitAction} className="flex flex-col gap-4">
          {/* Hidden field carries the selected tz value into FormData */}
          <input type="hidden" name="tz" value={selectedTz} />

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="tz-search">Timezone</Label>
            <SearchableSelect
              groups={COMMON_ZONES}
              value={selectedTz}
              onChange={setSelectedTz}
              placeholder="Search by city or timezone…"
              triggerClassName="h-9"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="person-input">
              Person / label <span className="text-slate-400 font-normal">(optional)</span>
            </Label>
            <Input
              id="person-input"
              name="person"
              placeholder="e.g. João, Backend team…"
              value={person}
              onChange={(e) => setPerson(e.target.value)}
              autoComplete="off"
            />
          </div>

          {formState.error && (
            <p className="text-sm text-red-500 -mt-1" role="alert">{formState.error}</p>
          )}

          <div className="flex justify-end gap-2 mt-1">
            <Button type="button" variant="outline" onClick={handleClose} disabled={isPending}>
              Cancel
            </Button>
            <Button type="submit" disabled={isPending || !selectedTz}>
              {isPending ? 'Adding…' : 'Add timezone'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
