"use client";

import { useCallback, useEffect, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { PetTimeline } from "@/components/dashboard/pet-timeline";
import { proxyUrl } from "@/lib/api";
import {
  type DashboardPet,
  type MedicalRecordType,
  type PetTimeline as PetTimelineData,
  MEDICAL_SECTIONS,
  formatPetType,
  getPetEmoji,
} from "@/lib/pets";

type PetMedicalSheetProps = {
  pet: DashboardPet | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onRecordAdded?: () => void;
};

type AddRecordForm = {
  type: MedicalRecordType;
  title: string;
  detail: string;
  date: string;
};

const INITIAL_FORM: AddRecordForm = {
  type: "note",
  title: "",
  detail: "",
  date: "",
};

function TimelineSkeleton() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 4 }).map((_, i) => (
        <Skeleton key={i} className="h-14 w-full" />
      ))}
    </div>
  );
}

type PetProfileForm = {
  breed: string;
  gender: string;
  birthDate: string;
  weight: string;
  sterilized: string;
  notes: string;
};

type PetMedicalSheetContentProps = {
  pet: DashboardPet;
  onRecordAdded?: () => void;
};

function PetMedicalSheetContent({ pet, onRecordAdded }: PetMedicalSheetContentProps) {
  const [timeline, setTimeline] = useState<PetTimelineData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<AddRecordForm>(INITIAL_FORM);
  const [formError, setFormError] = useState<string | null>(null);
  const [editingProfile, setEditingProfile] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);
  const [profile, setProfile] = useState<Partial<DashboardPet>>({
    breed: pet.breed,
    gender: pet.gender,
    birthDate: pet.birthDate,
    weight: pet.weight,
    sterilized: pet.sterilized,
    notes: pet.notes,
  });
  const [profileForm, setProfileForm] = useState<PetProfileForm>({
    breed: pet.breed ?? "",
    gender: pet.gender ?? "",
    birthDate: pet.birthDate ? pet.birthDate.slice(0, 10) : "",
    weight: pet.weight != null ? String(pet.weight) : "",
    sterilized: pet.sterilized != null ? String(pet.sterilized) : "",
    notes: pet.notes ?? "",
  });

  const reloadTimeline = useCallback(async () => {
    const res = await fetch(proxyUrl(`/api/dashboard/pets/${pet.id}/timeline`), {
      cache: "no-store",
    });
    if (!res.ok) throw new Error("No se pudo cargar el historial");
    return (await res.json()) as PetTimelineData;
  }, [pet.id]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      if (!cancelled) setLoading(true);
      try {
        const data = await reloadTimeline();
        if (!cancelled) { setTimeline(data); setError(null); }
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Error al cargar historial");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [reloadTimeline]);

  const handleSaveProfile = async () => {
    setSavingProfile(true);
    try {
      const res = await fetch(proxyUrl(`/api/dashboard/pets/${pet.id}`), {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          breed: profileForm.breed || null,
          gender: profileForm.gender || null,
          birthDate: profileForm.birthDate || null,
          weight: profileForm.weight ? Number(profileForm.weight) : null,
          sterilized:
            profileForm.sterilized === "true"
              ? true
              : profileForm.sterilized === "false"
                ? false
                : null,
          notes: profileForm.notes || null,
        }),
      });
      if (!res.ok) throw new Error("Error al guardar");
      const updated = await res.json();
      setProfile(updated);
      setEditingProfile(false);
    } catch (err) {
      console.error(err);
    } finally {
      setSavingProfile(false);
    }
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    const title = form.title.trim();
    if (!title) { setFormError("El título es obligatorio"); return; }
    setSaving(true);
    setFormError(null);
    try {
      const res = await fetch(proxyUrl(`/api/dashboard/pets/${pet.id}/records`), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: form.type,
          title,
          detail: form.detail.trim() || null,
          date: form.date || null,
        }),
      });
      if (!res.ok) {
        const payload = await res.json().catch(() => null);
        throw new Error(payload?.error || "No se pudo guardar el registro");
      }
      setForm(INITIAL_FORM);
      setShowForm(false);
      const data = await reloadTimeline();
      setTimeline(data);
      onRecordAdded?.();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Error al guardar registro");
    } finally {
      setSaving(false);
    }
  };

  const totalItems = (timeline?.items.length ?? 0);

  return (
    <>
      <SheetHeader className="border-b pb-4">
        <SheetTitle className="flex items-center gap-2 text-xl">
          <span>{getPetEmoji(pet.type)}</span>
          <span>{pet.name}</span>
        </SheetTitle>
        <SheetDescription>
          {formatPetType(pet.type)} · Dueño: {pet.owner.phone}
        </SheetDescription>
      </SheetHeader>

      <div className="flex flex-col gap-4 px-4 pb-4">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline">{totalItems} eventos en historial</Badge>
          <Badge variant="outline">{pet._count.appointments} citas</Badge>
          <a
            href={`/print/pets/${pet.id}`}
            target="_blank"
            rel="noopener noreferrer"
            className="ml-auto"
          >
            <Button size="sm" variant="outline" className="h-7 text-xs gap-1.5">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-3.5 h-3.5">
                <path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clipRule="evenodd" />
              </svg>
              Exportar ficha PDF
            </Button>
          </a>
        </div>

        {/* Ficha de la mascota */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-muted-foreground">Ficha</p>
            {!editingProfile && (
              <Button size="sm" variant="outline" onClick={() => setEditingProfile(true)}>
                Editar
              </Button>
            )}
          </div>
          {editingProfile ? (
            <div className="space-y-2 rounded-lg border bg-muted/30 p-3">
              <Input
                placeholder="Raza"
                value={profileForm.breed}
                onChange={(e) => setProfileForm((f) => ({ ...f, breed: e.target.value }))}
              />
              <select
                value={profileForm.gender}
                onChange={(e) => setProfileForm((f) => ({ ...f, gender: e.target.value }))}
                className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm"
              >
                <option value="">Sexo</option>
                <option value="male">Macho</option>
                <option value="female">Hembra</option>
              </select>
              <Input
                type="date"
                value={profileForm.birthDate}
                onChange={(e) => setProfileForm((f) => ({ ...f, birthDate: e.target.value }))}
              />
              <Input
                type="number"
                placeholder="Peso (kg)"
                value={profileForm.weight}
                onChange={(e) => setProfileForm((f) => ({ ...f, weight: e.target.value }))}
              />
              <select
                value={profileForm.sterilized}
                onChange={(e) => setProfileForm((f) => ({ ...f, sterilized: e.target.value }))}
                className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm"
              >
                <option value="">Esterilizado/a</option>
                <option value="true">Sí</option>
                <option value="false">No</option>
              </select>
              <Input
                placeholder="Notas"
                value={profileForm.notes}
                onChange={(e) => setProfileForm((f) => ({ ...f, notes: e.target.value }))}
              />
              <div className="flex gap-2">
                <Button size="sm" onClick={handleSaveProfile} disabled={savingProfile}>
                  {savingProfile ? "Guardando…" : "Guardar"}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setEditingProfile(false)}
                  disabled={savingProfile}
                >
                  Cancelar
                </Button>
              </div>
            </div>
          ) : (
            <div className="rounded-lg border bg-muted/30 px-3 py-3 text-sm space-y-1">
              {profile.breed && (
                <p><span className="text-muted-foreground">Raza: </span>{profile.breed}</p>
              )}
              {profile.gender && (
                <p>
                  <span className="text-muted-foreground">Sexo: </span>
                  {profile.gender === "male" ? "Macho" : "Hembra"}
                </p>
              )}
              {profile.birthDate && (
                <p>
                  <span className="text-muted-foreground">Nacimiento: </span>
                  {new Date(profile.birthDate).toLocaleDateString("es-CO")}
                </p>
              )}
              {profile.weight != null && (
                <p><span className="text-muted-foreground">Peso: </span>{profile.weight} kg</p>
              )}
              {profile.sterilized != null && (
                <p>
                  <span className="text-muted-foreground">Esterilizado/a: </span>
                  {profile.sterilized ? "Sí" : "No"}
                </p>
              )}
              {profile.notes && (
                <p><span className="text-muted-foreground">Notas: </span>{profile.notes}</p>
              )}
              {!profile.breed && !profile.gender && !profile.birthDate &&
                profile.weight == null && profile.sterilized == null && !profile.notes && (
                <p className="text-muted-foreground">Sin datos adicionales.</p>
              )}
            </div>
          )}
        </div>

        {/* Agregar nota / registro manual */}
        {!showForm ? (
          <Button type="button" size="sm" variant="outline" onClick={() => setShowForm(true)}>
            + Agregar nota
          </Button>
        ) : (
          <form
            onSubmit={handleSubmit}
            className="space-y-3 rounded-lg border bg-muted/30 p-4"
          >
            <p className="text-sm font-medium">Nuevo registro</p>
            <div className="space-y-1">
              <label htmlFor="record-type" className="text-xs text-muted-foreground">Tipo</label>
              <select
                id="record-type"
                value={form.type}
                onChange={(e) =>
                  setForm((f) => ({ ...f, type: e.target.value as MedicalRecordType }))
                }
                className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm"
              >
                {MEDICAL_SECTIONS.map((s) => (
                  <option key={s.type} value={s.type}>
                    {s.emoji} {s.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <label htmlFor="record-title" className="text-xs text-muted-foreground">Título</label>
              <Input
                id="record-title"
                value={form.title}
                onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                placeholder="Ej. Vacuna antirrábica"
              />
            </div>
            <div className="space-y-1">
              <label htmlFor="record-detail" className="text-xs text-muted-foreground">Detalle (opcional)</label>
              <Input
                id="record-detail"
                value={form.detail}
                onChange={(e) => setForm((f) => ({ ...f, detail: e.target.value }))}
                placeholder="Descripción adicional"
              />
            </div>
            <div className="space-y-1">
              <label htmlFor="record-date" className="text-xs text-muted-foreground">Fecha (opcional)</label>
              <Input
                id="record-date"
                type="date"
                value={form.date}
                onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))}
              />
            </div>
            {formError && <p className="text-sm text-destructive">{formError}</p>}
            <div className="flex gap-2">
              <Button type="submit" size="sm" disabled={saving}>
                {saving ? "Guardando…" : "Guardar"}
              </Button>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                disabled={saving}
                onClick={() => { setShowForm(false); setForm(INITIAL_FORM); setFormError(null); }}
              >
                Cancelar
              </Button>
            </div>
          </form>
        )}

        {/* Línea de tiempo */}
        {loading ? (
          <TimelineSkeleton />
        ) : error ? (
          <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-6 text-center text-sm text-destructive">
            {error}
          </div>
        ) : timeline ? (
          <PetTimeline items={timeline.items} nextActions={timeline.nextActions} onReload={reloadTimeline} />
        ) : null}
      </div>
    </>
  );
}

export function PetMedicalSheet({
  pet,
  open,
  onOpenChange,
  onRecordAdded,
}: PetMedicalSheetProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-xl">
        {open && pet ? (
          <PetMedicalSheetContent key={pet.id} pet={pet} onRecordAdded={onRecordAdded} />
        ) : null}
      </SheetContent>
    </Sheet>
  );
}
