"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

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
import { apiUrl } from "@/lib/api";
import {
  type DashboardPet,
  type MedicalRecordType,
  type PetMedicalRecord,
  MEDICAL_SECTIONS,
  formatPetType,
  formatRecordDate,
  getPetEmoji,
  groupRecordsByType,
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

function RecordsSkeleton() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 4 }).map((_, index) => (
        <Skeleton key={index} className="h-16 w-full" />
      ))}
    </div>
  );
}

type PetMedicalSheetContentProps = {
  pet: DashboardPet;
  onRecordAdded?: () => void;
};

type PetProfileForm = {
  breed: string;
  gender: string;
  birthDate: string;
  weight: string;
  sterilized: string;
  notes: string;
};

function PetMedicalSheetContent({
  pet,
  onRecordAdded,
}: PetMedicalSheetContentProps) {
  const [records, setRecords] = useState<PetMedicalRecord[]>([]);
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

  const handleSaveProfile = async () => {
    setSavingProfile(true);
    try {
      const res = await fetch(apiUrl(`/api/dashboard/pets/${pet.id}`), {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          breed: profileForm.breed || null,
          gender: profileForm.gender || null,
          birthDate: profileForm.birthDate || null,
          weight: profileForm.weight ? Number(profileForm.weight) : null,
          sterilized: profileForm.sterilized === "true" ? true : profileForm.sterilized === "false" ? false : null,
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

  const reloadRecords = useCallback(async () => {
    const response = await fetch(
      apiUrl(`/api/dashboard/pets/${pet.id}/records`),
      { cache: "no-store" }
    );

    if (!response.ok) {
      throw new Error("No se pudo cargar el expediente");
    }

    const data: PetMedicalRecord[] = await response.json();
    return Array.isArray(data) ? data : [];
  }, [pet]);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      try {
        const nextRecords = await reloadRecords();

        if (!cancelled) {
          setRecords(nextRecords);
          setError(null);
        }
      } catch (err) {
        console.error(err);

        if (!cancelled) {
          setError(
            err instanceof Error ? err.message : "Error al cargar expediente"
          );
          setRecords([]);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [reloadRecords]);

  const groupedRecords = useMemo(
    () => groupRecordsByType(records),
    [records]
  );

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    const title = form.title.trim();

    if (!title) {
      setFormError("El título es obligatorio");
      return;
    }

    setSaving(true);
    setFormError(null);

    try {
      const response = await fetch(
        apiUrl(`/api/dashboard/pets/${pet.id}/records`),
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            type: form.type,
            title,
            detail: form.detail.trim() || null,
            date: form.date || null,
          }),
        }
      );

      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        throw new Error(payload?.error || "No se pudo guardar el registro");
      }

      setForm(INITIAL_FORM);
      setShowForm(false);
      setRecords(await reloadRecords());
      onRecordAdded?.();
    } catch (err) {
      console.error(err);
      setFormError(
        err instanceof Error ? err.message : "Error al guardar registro"
      );
    } finally {
      setSaving(false);
    }
  };

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
          <Badge variant="outline">
            {pet._count.medicalRecords} registros médicos
          </Badge>
          <Badge variant="outline">{pet._count.appointments} citas</Badge>
        </div>

        {/* Ficha de la mascota */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-muted-foreground">Ficha</p>
            {!editingProfile && (
              <Button size="sm" variant="outline" onClick={() => setEditingProfile(true)}>Editar</Button>
            )}
          </div>
          {editingProfile ? (
            <div className="space-y-2 rounded-lg border bg-muted/30 p-3">
              <Input placeholder="Raza" value={profileForm.breed} onChange={(e) => setProfileForm((f) => ({ ...f, breed: e.target.value }))} />
              <select
                value={profileForm.gender}
                onChange={(e) => setProfileForm((f) => ({ ...f, gender: e.target.value }))}
                className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm"
              >
                <option value="">Sexo</option>
                <option value="male">Macho</option>
                <option value="female">Hembra</option>
              </select>
              <Input type="date" placeholder="Fecha de nacimiento" value={profileForm.birthDate} onChange={(e) => setProfileForm((f) => ({ ...f, birthDate: e.target.value }))} />
              <Input type="number" placeholder="Peso (kg)" value={profileForm.weight} onChange={(e) => setProfileForm((f) => ({ ...f, weight: e.target.value }))} />
              <select
                value={profileForm.sterilized}
                onChange={(e) => setProfileForm((f) => ({ ...f, sterilized: e.target.value }))}
                className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm"
              >
                <option value="">Esterilizado/a</option>
                <option value="true">Sí</option>
                <option value="false">No</option>
              </select>
              <Input placeholder="Notas" value={profileForm.notes} onChange={(e) => setProfileForm((f) => ({ ...f, notes: e.target.value }))} />
              <div className="flex gap-2">
                <Button size="sm" onClick={handleSaveProfile} disabled={savingProfile}>{savingProfile ? "Guardando…" : "Guardar"}</Button>
                <Button size="sm" variant="outline" onClick={() => setEditingProfile(false)} disabled={savingProfile}>Cancelar</Button>
              </div>
            </div>
          ) : (
            <div className="rounded-lg border bg-muted/30 px-3 py-3 text-sm space-y-1">
              {profile.breed && <p><span className="text-muted-foreground">Raza: </span>{profile.breed}</p>}
              {profile.gender && <p><span className="text-muted-foreground">Sexo: </span>{profile.gender === "male" ? "Macho" : "Hembra"}</p>}
              {profile.birthDate && <p><span className="text-muted-foreground">Nacimiento: </span>{new Date(profile.birthDate).toLocaleDateString("es-CO")}</p>}
              {profile.weight != null && <p><span className="text-muted-foreground">Peso: </span>{profile.weight} kg</p>}
              {profile.sterilized != null && <p><span className="text-muted-foreground">Esterilizado/a: </span>{profile.sterilized ? "Sí" : "No"}</p>}
              {profile.notes && <p><span className="text-muted-foreground">Notas: </span>{profile.notes}</p>}
              {!profile.breed && !profile.gender && !profile.birthDate && profile.weight == null && profile.sterilized == null && !profile.notes && (
                <p className="text-muted-foreground">Sin datos adicionales.</p>
              )}
            </div>
          )}
        </div>

        {!showForm ? (
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => setShowForm(true)}
          >
            Agregar nota
          </Button>
        ) : (
          <form
            onSubmit={handleSubmit}
            className="space-y-3 rounded-lg border bg-muted/30 p-4"
          >
            <p className="text-sm font-medium">Nuevo registro médico</p>

            <div className="space-y-1">
              <label
                htmlFor="record-type"
                className="text-xs text-muted-foreground"
              >
                Tipo
              </label>
              <select
                id="record-type"
                value={form.type}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    type: event.target.value as MedicalRecordType,
                  }))
                }
                className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm"
              >
                {MEDICAL_SECTIONS.map((section) => (
                  <option key={section.type} value={section.type}>
                    {section.emoji} {section.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1">
              <label
                htmlFor="record-title"
                className="text-xs text-muted-foreground"
              >
                Título
              </label>
              <Input
                id="record-title"
                value={form.title}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    title: event.target.value,
                  }))
                }
                placeholder="Ej. Control post-operatorio"
              />
            </div>

            <div className="space-y-1">
              <label
                htmlFor="record-detail"
                className="text-xs text-muted-foreground"
              >
                Detalle (opcional)
              </label>
              <Input
                id="record-detail"
                value={form.detail}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    detail: event.target.value,
                  }))
                }
                placeholder="Descripción adicional"
              />
            </div>

            <div className="space-y-1">
              <label
                htmlFor="record-date"
                className="text-xs text-muted-foreground"
              >
                Fecha (opcional)
              </label>
              <Input
                id="record-date"
                type="date"
                value={form.date}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    date: event.target.value,
                  }))
                }
              />
            </div>

            {formError ? (
              <p className="text-sm text-destructive">{formError}</p>
            ) : null}

            <div className="flex gap-2">
              <Button type="submit" size="sm" disabled={saving}>
                {saving ? "Guardando…" : "Guardar"}
              </Button>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                disabled={saving}
                onClick={() => {
                  setShowForm(false);
                  setForm(INITIAL_FORM);
                  setFormError(null);
                }}
              >
                Cancelar
              </Button>
            </div>
          </form>
        )}

        {loading ? (
          <RecordsSkeleton />
        ) : error ? (
          <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-6 text-center text-sm text-destructive">
            {error}
          </div>
        ) : (
          <div className="space-y-3">
            {MEDICAL_SECTIONS.map((section) => {
              const items = groupedRecords[section.type];

              return (
                <details
                  key={section.type}
                  className="group rounded-lg border bg-background"
                  open={items.length > 0}
                >
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-4 py-3 font-medium [&::-webkit-details-marker]:hidden">
                    <span>
                      {section.emoji} {section.label}
                    </span>
                    <Badge variant="secondary">{items.length}</Badge>
                  </summary>

                  <div className="space-y-3 border-t px-4 py-3">
                    {items.length === 0 ? (
                      <p className="text-sm text-muted-foreground">
                        Sin registros en esta categoría.
                      </p>
                    ) : (
                      items.map((record) => (
                        <div
                          key={record.id}
                          className="rounded-md border border-dashed px-3 py-2"
                        >
                          <p className="font-medium">{record.title}</p>
                          {record.detail ? (
                            <p className="mt-1 text-sm text-muted-foreground">
                              {record.detail}
                            </p>
                          ) : null}
                          <p className="mt-2 text-xs text-muted-foreground">
                            {record.date
                              ? `Fecha: ${formatRecordDate(record.date)}`
                              : `Registrado: ${formatRecordDate(record.createdAt)}`}
                          </p>
                        </div>
                      ))
                    )}
                  </div>
                </details>
              );
            })}
          </div>
        )}
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
          <PetMedicalSheetContent
            key={pet.id}
            pet={pet}
            onRecordAdded={onRecordAdded}
          />
        ) : null}
      </SheetContent>
    </Sheet>
  );
}
