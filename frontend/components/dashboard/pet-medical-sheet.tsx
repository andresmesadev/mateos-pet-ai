"use client";

import { useCallback, useEffect, useId, useState } from "react";
import {
  Download,
  Syringe,
  Pill,
  Scissors,
  AlertCircle,
  StickyNote,
  Stethoscope,
  ChevronLeft,
  CalendarPlus,
  PawPrint,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { NewAppointmentDialog } from "@/components/dashboard/new-appointment-dialog";
import { ProtectedDialog, SavedChangesStatus, useDialogEditGuard } from "@/components/dashboard/protected-dialog";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { PetGroomingHistory } from "@/components/dashboard/pet-grooming-history";
import { PetGroomingPrices } from "@/components/dashboard/pet-grooming-prices";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { OperationalPetSheet, OperationalAlerts } from "@/components/dashboard/operational-pet-sheet";
import { useDashboardAccess } from "@/components/dashboard/dashboard-access-provider";
import { PetRecordForm, type QuickRecordKind } from "@/components/dashboard/pet-record-form";
import { formatPetAge } from "@/lib/contact-profile-utils";
import { PetTimeline } from "@/components/dashboard/pet-timeline";
import { VetConsultationDialog } from "@/components/dashboard/vet-consultation-dialog";
import { proxyUrl } from "@/lib/api";
import { tenantQuery, useTenant } from "@/lib/use-tenant";
import { useToast } from "@/components/ui/toast";
import {
  type DashboardPet,
  type MedicalRecordType,
  type PetTimeline as PetTimelineData,
  type TimelineItem,
  formatRecordDate,
  formatPetType,
  getPetEmoji,
} from "@/lib/pets";
import { cn } from "@/lib/utils";

type PetMedicalSheetProps = {
  pet: DashboardPet | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onRecordAdded?: () => void;
  initialEdit?: boolean;
};

type AddRecordForm = {
  type: MedicalRecordType;
  title: string;
  detail: string;
  date: string;
};

const INITIAL_FORM: AddRecordForm = { type: "note", title: "", detail: "", date: "" };

type ActiveForm = "vaccine" | "deworming" | "grooming" | "allergy" | "note" | "consultation";

const ACTION_BUTTONS: {
  id: ActiveForm;
  label: string;
  icon: React.ElementType;
  color: string;
  bg: string;
  ring: string;
}[] = [
  { id: "consultation", label: "Antecedente sin cita", icon: Stethoscope, color: "text-sky-700", bg: "bg-sky-500/10", ring: "ring-sky-500/25 border-sky-500/20" },
  { id: "vaccine",      label: "Vacuna",           icon: Syringe,     color: "text-emerald-700",bg: "bg-emerald-500/10",ring: "ring-emerald-500/25 border-emerald-500/20" },
  { id: "deworming",    label: "Desparasitación",  icon: Pill,        color: "text-violet-700", bg: "bg-violet-500/10", ring: "ring-violet-500/25 border-violet-500/20" },
  { id: "grooming",     label: "Peluquería",       icon: Scissors,    color: "text-amber-700",  bg: "bg-amber-500/10",  ring: "ring-amber-500/25 border-amber-500/20" },
  { id: "allergy",      label: "Alergia",          icon: AlertCircle, color: "text-rose-700",   bg: "bg-rose-500/10",   ring: "ring-rose-500/25 border-rose-500/20" },
  { id: "note",         label: "Nota",             icon: StickyNote,  color: "text-muted-foreground", bg: "bg-accent/40", ring: "ring-black/10 border-black/[0.06]" },
];

const SELECT_CLASS =
  "flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm transition-colors focus:outline-none focus:ring-1 focus:ring-ring";

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
  petName: string; ownerName: string; ownerPhone: string;
  breed: string; gender: string; birthDate: string;
  weight: string; sterilized: string; notes: string;
};

function PetMedicalSheetContent({
  pet,
  onRecordAdded,
  initialEdit = false,
}: {
  pet: DashboardPet;
  onRecordAdded?: () => void;
  initialEdit?: boolean;
}) {
  const access = useDashboardAccess();
  const admin = Boolean(access?.capabilities.administration);
  const canManageRecords = admin && Boolean(access?.capabilities.clinical);
  const { toast } = useToast();
  const tenant = useTenant();
  const [timeline, setTimeline]           = useState<PetTimelineData | null>(null);
  const [loading, setLoading]             = useState(true);
  const [error, setError]                 = useState<string | null>(null);
  const [activeForm, setActiveForm]       = useState<ActiveForm | null>(null);
  const [showConsultation, setShowConsultation] = useState(false);
  const [saving, setSaving]               = useState(false);
  const [form, setForm]                   = useState<AddRecordForm>(INITIAL_FORM);
  const [nextDate, setNextDate]           = useState("");
  const [formError, setFormError]         = useState<string | null>(null);
  const [editingProfile, setEditingProfile]   = useState(initialEdit && admin);
  const [savingProfile, setSavingProfile]     = useState(false);
  const [profile, setProfile]             = useState<Partial<DashboardPet>>({
    breed: pet.breed, gender: pet.gender, birthDate: pet.birthDate,
    weight: pet.weight, sterilized: pet.sterilized, notes: pet.notes,
  });
  const [petName, setPetName]             = useState(pet.name);
  const [ownerName, setOwnerName]         = useState(pet.owner?.name ?? "");
  const [ownerPhone, setOwnerPhone]       = useState(pet.owner?.phone ?? "");
  const [operationalAlerts, setOperationalAlerts] = useState(pet.operationalAlerts ?? "");
  const [profileForm, setProfileForm]     = useState<PetProfileForm>({
    petName:    pet.name,
    ownerName:  pet.owner?.name ?? "",
    ownerPhone: pet.owner?.phone ?? "",
    breed:      pet.breed ?? "",
    gender:     pet.gender ?? "",
    birthDate:  pet.birthDate ? pet.birthDate.slice(0, 10) : "",
    weight:     pet.weight != null ? String(pet.weight) : "",
    sterilized: pet.sterilized != null ? String(pet.sterilized) : "",
    notes:      pet.notes ?? "",
  });
  const [savedAt, setSavedAt] = useState<Date | null>(null);
  const [newAppointment, setNewAppointment] = useState(false);
  const recordFormId = useId();
  const [activeTab, setActiveTab] = useState("ficha");
  const [selectedAllergy, setSelectedAllergy] = useState<TimelineItem | null>(null);
  const savedProfile: PetProfileForm = {
    petName, ownerName, ownerPhone, breed: profile.breed ?? "", gender: profile.gender ?? "",
    birthDate: profile.birthDate?.slice(0, 10) ?? "", weight: profile.weight != null ? String(profile.weight) : "",
    sterilized: profile.sterilized != null ? String(profile.sterilized) : "", notes: profile.notes ?? "",
  };
  const profileDirty = editingProfile && (Object.keys(savedProfile) as (keyof PetProfileForm)[]).some((field) => profileForm[field] !== savedProfile[field]);
  const recordDirty = Boolean(activeForm && (form.title || form.detail || form.date || nextDate));
  const [groomingPriceEdit, setGroomingPriceEdit] = useState({ dirty: false, saving: false });
  const dirty = profileDirty || recordDirty || groomingPriceEdit.dirty;
  const busy = saving || savingProfile || groomingPriceEdit.saving;
  const discard = useDialogEditGuard(dirty, busy);

  const reloadTimeline = useCallback(async () => {
    const res = await fetch(proxyUrl(`/api/dashboard/pets/${pet.id}/timeline${tenantQuery(tenant)}`), { cache: "no-store" });
    if (!res.ok) throw new Error("No se pudo cargar el historial");
    return (await res.json()) as PetTimelineData;
  }, [pet.id, tenant]);

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

  function openForm(id: ActiveForm) {
    if (id === "consultation") { setShowConsultation(true); return; }
    if (id === "grooming") { setActiveTab("peluqueria"); return; }
    setActiveForm(id);
    setForm({ ...INITIAL_FORM, type: id as MedicalRecordType });
    setNextDate("");
    setFormError(null);
  }

  function closeForm() {
    setActiveForm(null);
    setForm(INITIAL_FORM);
    setNextDate("");
    setFormError(null);
  }

  async function handleSaveProfile() {
    setSavingProfile(true);
    try {
      const ownerChanged = profileForm.ownerName !== ownerName || profileForm.ownerPhone !== ownerPhone;
      let ownerId = pet.owner?.id;
      if (ownerChanged && !ownerId) {
        const response = await fetch(proxyUrl(`/api/dashboard/pets/${pet.id}${tenantQuery(tenant)}`), { cache: "no-store" });
        if (!response.ok) throw new Error("No se pudo verificar el propietario. Intenta de nuevo.");
        const current = await response.json() as DashboardPet;
        ownerId = current.owner?.id;
        if (!ownerId) throw new Error("No se pudo identificar al propietario. No se guardaron los cambios.");
      }
      // Guardar mascota (nombre + datos clínicos)
      const petRes = await fetch(proxyUrl(`/api/dashboard/pets/${pet.id}${tenantQuery(tenant)}`), {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name:       profileForm.petName.trim() || pet.name,
          breed:      profileForm.breed || null,
          gender:     profileForm.gender || null,
          birthDate:  profileForm.birthDate || null,
          weight:     profileForm.weight ? Number(profileForm.weight) : null,
          sterilized: profileForm.sterilized === "true" ? true : profileForm.sterilized === "false" ? false : null,
          notes:      profileForm.notes || null,
        }),
      });
      if (!petRes.ok) throw new Error("Error al guardar mascota");
      const updatedPet = await petRes.json();
      setProfile(updatedPet);
      setPetName(profileForm.petName.trim() || pet.name);

      // Guardar propietario si tiene id
      if (ownerChanged && ownerId) {
        const ownerRes = await fetch(proxyUrl(`/api/dashboard/clients/${ownerId}${tenantQuery(tenant)}`), {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name:  profileForm.ownerName.trim() || null,
            phone: profileForm.ownerPhone.trim() || null,
          }),
        });
        if (!ownerRes.ok) throw new Error("Error al guardar propietario");
        setOwnerName(profileForm.ownerName.trim());
        setOwnerPhone(profileForm.ownerPhone.trim());
      }

      setEditingProfile(false);
      setSavedAt(new Date());
      onRecordAdded?.();
      toast("Ficha guardada.", "success");
    } catch (err) {
      toast(err instanceof Error ? err.message : "No se guardó. Intenta de nuevo.", "error");
    } finally {
      setSavingProfile(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const title = form.title.trim();
    if (!title) { setFormError("El título es obligatorio"); return; }
    setSaving(true);
    setFormError(null);
    try {
      const res = await fetch(proxyUrl(`/api/dashboard/pets/${pet.id}/records${tenantQuery(tenant)}`), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type:           form.type,
          title,
          detail:         form.detail.trim() || null,
          date:           form.date || null,
          nextControlAt:  (form.type === "vaccine" || form.type === "deworming" || form.type === "grooming") && nextDate ? nextDate : null,
        }),
      });
      if (!res.ok) {
        const payload = await res.json().catch(() => null);
        throw new Error(payload?.error || "No se pudo guardar el registro");
      }
      closeForm();
      setSavedAt(new Date());
      onRecordAdded?.();
      toast("Registro guardado.", "success");
      try { const data = await reloadTimeline(); setTimeline(data); setError(null); }
      catch { setError("El registro se guardó, pero no se pudo actualizar el historial. Reintenta la carga."); }
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Error al guardar registro");
    } finally {
      setSaving(false);
    }
  }

  const activeBtn = ACTION_BUTTONS.find((b) => b.id === activeForm);
  const allergies = timeline?.items.filter((item) => item.kind === "allergy" && item.recordId) ?? [];

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* Header */}
      <div className="flex shrink-0 flex-wrap items-start justify-between gap-4 border-b border-black/[0.06] py-5 pl-6 pr-14">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-500/15 text-xl ring-1 ring-amber-500/25">
            {getPetEmoji(pet.type)}
          </div>
          <div className="min-w-0">
            <DialogTitle className="text-base font-semibold tracking-tight">{petName}</DialogTitle>
            <DialogDescription className="break-words text-sm text-muted-foreground">
              {formatPetType(pet.type)}
              {ownerName ? ` · ${ownerName}` : ""}
              {ownerPhone ? ` · ${ownerPhone}` : ""}
            </DialogDescription>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline" className="text-xs tabular-nums">
            {timeline?.items.length ?? "–"} eventos
          </Badge>
          <Badge variant="outline" className="text-xs tabular-nums">
            {pet._count.appointments} citas
          </Badge>
          <a href={`/print/pets/${pet.id}${tenantQuery(tenant)}`} target="_blank" rel="noopener noreferrer">
            <Button size="sm" variant="outline" className="h-7 gap-1.5 text-xs">
              <Download className="h-3.5 w-3.5" />
              PDF
            </Button>
          </a>
        </div>
      </div>

      {/* Body */}
      <div className="flex flex-1 flex-col gap-5 overflow-y-auto px-6 py-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <SavedChangesStatus dirty={dirty} saving={busy} savedAt={savedAt} />
          {access?.capabilities.schedule && <Button className="gap-2" disabled={dirty || busy} onClick={() => setNewAppointment(true)}><CalendarPlus className="h-4 w-4" />Nueva cita para {petName}</Button>}
        </div>
        {dirty && <p className="text-xs text-muted-foreground">Guarda o cancela los cambios antes de agendar.</p>}
        <dl aria-label="Resumen de la mascota" className="grid grid-cols-2 gap-x-6 gap-y-4 border-y py-4 sm:grid-cols-4">
          {[["Especie", formatPetType(pet.type)], ["Raza", profile.breed || "Sin registrar"], ["Edad", formatPetAge(profile.birthDate)], ["Peso registrado", profile.weight != null ? `${profile.weight} kg` : "Sin registrar"]].map(([label, value]) => <div key={label} className="min-w-0"><dt className="text-xs text-muted-foreground">{label}</dt><dd className="mt-1 break-words text-sm font-semibold">{value}</dd></div>)}
        </dl>
        {allergies.length > 0 && <section aria-label="Alergias registradas" className="rounded-xl border border-rose-200 bg-rose-50 p-4">
          <h3 className="flex items-center gap-2 font-semibold text-rose-900"><AlertCircle className="size-4" />Alergias registradas</h3>
          <ul className="mt-2 divide-y divide-rose-200">{allergies.map((item) => <li key={item.id} className="flex flex-wrap items-start justify-between gap-3 py-3"><div className="min-w-0 flex-1"><p className="break-words text-sm font-semibold">{item.title}</p><p className="mt-1 text-xs text-rose-900">Registrada el <time dateTime={item.date}>{formatRecordDate(item.date, Boolean(item.recordId && !item.appointmentId && /T00:00:00(?:\.000)?Z$/.test(item.date)))}</time></p>{item.detail && <p className="mt-1 whitespace-pre-wrap break-words text-sm">{item.detail}</p>}</div><Button type="button" variant="outline" className="min-h-11 border-rose-200 bg-white text-rose-950" aria-label={`Ver detalle de ${item.title}`} onClick={() => setSelectedAllergy(item)}>Ver detalle</Button></li>)}</ul>
          <p className="mt-2 text-xs text-rose-800">Antecedentes registrados. El profesional debe confirmar su vigencia antes de la atención.</p>
        </section>}
        {error && <p role="alert" className="text-sm text-destructive">No se pudieron comprobar los antecedentes de alergias. Reintenta la carga del historial.</p>}
        {(profile.notes || operationalAlerts.trim()) && <section aria-label="Cuidados importantes" className="rounded-xl border border-amber-200 bg-amber-50/60 p-4">
          <div className="flex flex-wrap items-center justify-between gap-2"><h3 className="flex items-center gap-2 font-semibold"><AlertCircle className="h-4 w-4 text-amber-700" />Cuidados importantes</h3><Button size="sm" variant="outline" disabled={busy || !admin} onClick={() => { if (!editingProfile) setProfileForm(savedProfile); setEditingProfile(true); setActiveTab("ficha"); }}>Editar cuidados</Button></div>
          {operationalAlerts.trim() && <p className="mt-2 whitespace-pre-wrap break-words text-sm">{operationalAlerts}</p>}
          {profile.notes && <p className="mt-2 whitespace-pre-wrap break-words text-sm">{profile.notes}</p>}
        </section>}

        <Tabs value={activeTab} onValueChange={setActiveTab} className="gap-5">
          <TabsList aria-label="Secciones de la ficha" className={cn("grid h-auto! w-full grid-cols-2 gap-1", (admin || access?.capabilities.grooming) && "sm:grid-cols-3")}>
            <TabsTrigger value="ficha" className="min-h-11">Datos y cuidados</TabsTrigger>
            <TabsTrigger value="historial" className="min-h-11">Historial y citas</TabsTrigger>
            {(admin || access?.capabilities.grooming) && <TabsTrigger value="peluqueria" className="min-h-11">Peluquería</TabsTrigger>}
          </TabsList>
          <TabsContent value="ficha" forceMount className="data-[state=inactive]:hidden">
          <section className="mb-4 rounded-xl border bg-teal-50/40 p-4"><h3 className="font-semibold">Propietario</h3><p className="mt-1 text-sm">{ownerName || "Sin nombre registrado"}</p><p className="text-sm text-muted-foreground">{ownerPhone || "Sin teléfono registrado"}</p><p className="mt-2 text-sm font-medium">Dirección</p><p className="break-words text-sm text-muted-foreground">{pet.owner?.address || "Sin dirección registrada en el cliente"}</p><p className="mt-2 text-sm font-medium">Barrio</p><p className="break-words text-sm text-muted-foreground">{pet.owner?.neighborhood || "Sin barrio registrado en el cliente"}</p></section>
        {/* Ficha */}
        <div className="rounded-2xl border border-primary/15 bg-card [&_input]:h-11 [&_select]:h-11">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-4 sm:px-5">
            <h3 className="flex items-center gap-2 text-sm font-semibold"><PawPrint aria-hidden="true" className="h-4 w-4 text-primary" />Datos y cuidados de la mascota</h3>
            {admin && !editingProfile && (
              <Button variant="outline" size="sm" className="min-h-10"
                type="button"
                  onClick={() => { setProfileForm(savedProfile); setEditingProfile(true); }}
              >
                Editar
              </Button>
            )}
          </div>

          {editingProfile && (
            <fieldset disabled={savingProfile} aria-label="Identificación de la mascota" className="space-y-4 p-4 sm:p-5">
              {/* Identificación */}
              <h3 className="text-sm font-semibold">Identificación</h3>
              <div className="grid grid-cols-1 gap-3">
                <div className="space-y-1.5">
                  <label htmlFor="pet-name" className="text-sm font-semibold">Nombre de la mascota</label>
                  <Input id="pet-name" value={profileForm.petName}
                    onChange={(e) => setProfileForm((f) => ({ ...f, petName: e.target.value }))}
                    placeholder="Ej. Max" />
                </div>
              </div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <label htmlFor="pet-owner-name" className="text-sm font-semibold">Nombre del propietario</label>
                  <Input id="pet-owner-name" value={profileForm.ownerName}
                    onChange={(e) => setProfileForm((f) => ({ ...f, ownerName: e.target.value }))}
                    placeholder="Ej. María López" />
                </div>
                <div className="space-y-1.5">
                  <label htmlFor="pet-owner-phone" className="text-sm font-semibold">Teléfono / WhatsApp</label>
                  <Input id="pet-owner-phone" type="tel" value={profileForm.ownerPhone}
                    onChange={(e) => setProfileForm((f) => ({ ...f, ownerPhone: e.target.value }))}
                    placeholder="+57 300 000 0000" />
                </div>
              </div>
              <p className="text-xs text-muted-foreground">Los datos del propietario se comparten con sus demás mascotas.</p>
            </fieldset>
          )}

          {admin && <div className="px-4 py-3 sm:px-5"><PetGroomingPrices petId={pet.id} onEditStateChange={setGroomingPriceEdit} /></div>}

          {editingProfile ? (
            <fieldset disabled={savingProfile} aria-label="Datos clínicos" className="space-y-4 p-4 sm:p-5">
              <div className="border-t border-border pt-4">
                <h3 className="flex items-center gap-2 text-sm font-semibold"><Stethoscope aria-hidden="true" className="h-4 w-4 text-primary" />Datos clínicos</h3>
              </div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <label htmlFor="pet-breed" className="text-sm font-semibold">Raza</label>
                  <Input id="pet-breed" placeholder="Ej. Golden Retriever" value={profileForm.breed}
                    onChange={(e) => setProfileForm((f) => ({ ...f, breed: e.target.value }))} />
                </div>
                <div className="space-y-1.5">
                  <label htmlFor="pet-gender" className="text-sm font-semibold">Sexo</label>
                  <select id="pet-gender" value={profileForm.gender}
                    onChange={(e) => setProfileForm((f) => ({ ...f, gender: e.target.value }))}
                    className={SELECT_CLASS}>
                    <option value="">Sin especificar</option>
                    <option value="male">Macho</option>
                    <option value="female">Hembra</option>
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label htmlFor="pet-birth" className="text-sm font-semibold">Fecha de nacimiento</label>
                  <Input id="pet-birth" type="date" value={profileForm.birthDate}
                    onChange={(e) => setProfileForm((f) => ({ ...f, birthDate: e.target.value }))} />
                </div>
                <div className="space-y-1.5">
                  <label htmlFor="pet-weight" className="text-sm font-semibold">Peso (kg)</label>
                  <Input id="pet-weight" type="number" step="0.1" min="0" placeholder="Ej. 12.5" value={profileForm.weight}
                    onChange={(e) => setProfileForm((f) => ({ ...f, weight: e.target.value }))} />
                </div>
                <div className="space-y-1.5">
                  <label htmlFor="pet-sterilized" className="text-sm font-semibold">Esterilizado/a</label>
                  <select id="pet-sterilized" value={profileForm.sterilized}
                    onChange={(e) => setProfileForm((f) => ({ ...f, sterilized: e.target.value }))}
                    className={SELECT_CLASS}>
                    <option value="">Sin especificar</option>
                    <option value="true">Sí</option>
                    <option value="false">No</option>
                  </select>
                </div>
                <div className="space-y-2 border-t border-border pt-4 sm:col-span-2">
                  <label htmlFor="pet-notes" className="text-sm font-semibold">Notas</label>
                  <Textarea id="pet-notes" rows={3} className="min-h-24 resize-y bg-background/40 leading-relaxed" placeholder="Cuidados, comportamiento o precauciones que el equipo debe tener en cuenta…" value={profileForm.notes}
                    onChange={(e) => setProfileForm((f) => ({ ...f, notes: e.target.value }))} />
                </div>
              </div>
              <div className="flex flex-wrap justify-end gap-2 border-t border-border pt-4">
                <Button className="min-h-11" variant="outline" onClick={() => discard(() => { setProfileForm(savedProfile); setEditingProfile(false); }, profileDirty)} disabled={savingProfile}>
                  Cancelar
                </Button>
                <Button className="min-h-11" onClick={handleSaveProfile} disabled={savingProfile}>
                  {savingProfile ? "Guardando…" : "Guardar ficha"}
                </Button>
              </div>
            </fieldset>
          ) : (
            <div className="divide-y divide-black/[0.04]">
              <h3 className="flex items-center gap-2 px-4 py-4 text-sm font-semibold sm:px-5"><Stethoscope aria-hidden="true" className="h-4 w-4 text-primary" />Datos clínicos</h3>
              {(
                [
                  profile.breed      ? ["Raza",           profile.breed] : null,
                  profile.gender     ? ["Sexo",           profile.gender === "male" ? "Macho" : "Hembra"] : null,
                  profile.birthDate  ? ["Nacimiento",     new Date(profile.birthDate).toLocaleDateString("es-CO")] : null,
                  profile.weight != null ? ["Peso",       `${profile.weight} kg`] : null,
                  profile.sterilized != null ? ["Esterilizado/a", profile.sterilized ? "Sí" : "No"] : null,
                ] as ([string, string] | null)[]
              ).filter((row): row is [string, string] => row !== null).map(([label, value]) => (
                <div key={label} className="flex items-center gap-4 px-4 py-2.5 text-sm">
                  <span className="w-32 shrink-0 text-muted-foreground">{label}</span>
                  <span className="font-medium">{value}</span>
                </div>
              ))}
              {!profile.breed && !profile.gender && !profile.birthDate &&
                profile.weight == null && profile.sterilized == null && (
                <p className="px-4 py-3 text-sm text-muted-foreground">Sin datos adicionales.</p>
              )}
            </div>
          )}
        </div>

          {editingProfile && <div className="mt-4"><OperationalAlerts pet={{ ...pet, operationalAlerts }} onSaved={value => { setOperationalAlerts(value); onRecordAdded?.(); }} /></div>}
          </TabsContent>
          <TabsContent value="peluqueria"><PetGroomingHistory petId={pet.id} appointments={timeline?.items ?? []} onSaved={() => { setSavedAt(new Date()); onRecordAdded?.(); }} /></TabsContent>
          <TabsContent value="historial" forceMount className="space-y-5 data-[state=inactive]:hidden">
        {/* Botones de acción */}
        {canManageRecords && !activeForm && (
          <div>
            <h3 className="text-lg font-semibold">Agregar registro</h3>
            <p className="mb-4 mt-1 text-sm text-muted-foreground">Guarda antecedentes y observaciones de esta mascota. Para una cita programada, registra la atención en su sección correspondiente.</p>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {ACTION_BUTTONS.map((btn) => {
                const Icon = btn.icon;
                return (
                  <button
                    key={btn.id}
                    type="button"
                    onClick={() => openForm(btn.id)}
                    className={cn(
                      "group flex min-h-20 items-center gap-3 rounded-xl border p-4 text-left transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
                      "hover:border-primary/40",
                      btn.ring,
                      btn.bg
                    )}
                  >
                    <div className={cn("flex h-8 w-8 items-center justify-center rounded-lg ring-1 transition-transform group-hover:scale-110", btn.bg, btn.ring)}>
                      <Icon className={cn("h-4 w-4", btn.color)} />
                    </div>
                    <span className={cn("text-sm font-semibold leading-tight", btn.color)}>
                      {btn.id === "grooming" ? "Notas de peluquería" : btn.label}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {activeForm && activeForm !== "consultation" && activeForm !== "grooming" && activeBtn && <div className="space-y-3">
          <Button type="button" variant="ghost" disabled={saving} onClick={() => discard(closeForm, recordDirty)} className="gap-2"><ChevronLeft className="size-4" />Volver a tipos de registro</Button>
          <PetRecordForm key={activeForm} id={recordFormId} kind={activeForm as QuickRecordKind} petName={petName} form={form} nextDate={nextDate} saving={saving} error={formError}
            onChange={(field, value) => { setForm((current) => ({ ...current, [field]: value })); setFormError(null); }}
            onNextDate={(value) => { setNextDate(value); setFormError(null); }} onSubmit={handleSubmit} />
        </div>}

        {!canManageRecords && access?.capabilities.clinical && <p className="rounded-xl border bg-teal-50 p-4 text-sm">Para guardar o corregir tu atención, abre la consulta correspondiente desde el historial o desde Consultas veterinarias.</p>}
        {/* Timeline */}
        <div>
          <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Historial</p>
          {loading ? (
            <TimelineSkeleton />
          ) : error ? (
            <div className="rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-6 text-center text-sm text-destructive">
              {error}<Button variant="outline" className="mx-auto mt-3 block" onClick={() => { void reloadTimeline().then((data) => { setTimeline(data); setError(null); }).catch(() => setError("No se pudo cargar el historial. Intenta de nuevo.")); }}>Reintentar</Button>
            </div>
          ) : timeline ? (
            <PetTimeline items={timeline.items} nextActions={timeline.nextActions} petId={pet.id} onReload={() => {
              void reloadTimeline().then((data) => { setTimeline(data); setError(null); onRecordAdded?.(); }).catch(() => setError("No se pudo actualizar el historial. Reintenta la carga."));
            }} />
          ) : null}
        </div>
          </TabsContent>
        </Tabs>
      </div>

      {activeForm && activeForm !== "consultation" && activeForm !== "grooming" && activeTab === "historial" && <footer className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-t bg-card px-6 py-4">
        <p className="text-sm text-muted-foreground">Registro de {petName} · {activeBtn?.label}</p>
        <div className="flex gap-2"><Button variant="outline" disabled={saving} onClick={() => discard(closeForm, recordDirty)}>Cancelar</Button><Button type="submit" form={recordFormId} disabled={saving}>{saving ? "Guardando…" : "Guardar registro"}</Button></div>
      </footer>}
      <VetConsultationDialog
        open={showConsultation}
        onOpenChange={setShowConsultation}
        petId={pet.id}
        petName={pet.name}
        onSaved={async () => {
          setSavedAt(new Date());
          onRecordAdded?.();
          try { const data = await reloadTimeline(); setTimeline(data); setError(null); }
          catch { setError("El antecedente se guardó, pero no se pudo actualizar el historial. Reintenta la carga."); }
        }}
      />
      <Dialog open={Boolean(selectedAllergy)} onOpenChange={(open) => { if (!open) setSelectedAllergy(null); }}>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-xl">
          <DialogTitle>Detalle de alergia registrada</DialogTitle>
          <DialogDescription>Antecedente de {petName}. El profesional debe confirmar su vigencia antes de la atención.</DialogDescription>
          {selectedAllergy && <dl className="space-y-4 text-sm"><div><dt className="font-semibold text-muted-foreground">Sustancia o alergia</dt><dd className="mt-1 break-words font-semibold">{selectedAllergy.title}</dd></div><div><dt className="font-semibold text-muted-foreground">Fecha del registro</dt><dd className="mt-1">{formatRecordDate(selectedAllergy.date, Boolean(selectedAllergy.recordId && !selectedAllergy.appointmentId && /T00:00:00(?:\.000)?Z$/.test(selectedAllergy.date)))}</dd></div>{selectedAllergy.staffName && <div><dt className="font-semibold text-muted-foreground">Profesional registrado</dt><dd className="mt-1">{selectedAllergy.staffName}</dd></div>}<div><dt className="font-semibold text-muted-foreground">Reacción y observaciones</dt><dd className="mt-1 whitespace-pre-wrap break-words">{selectedAllergy.detail || "Sin observaciones adicionales."}</dd></div></dl>}
          <div className="flex justify-end"><Button variant="outline" className="min-h-11" onClick={() => setSelectedAllergy(null)}>Cerrar detalle</Button></div>
        </DialogContent>
      </Dialog>
      {newAppointment && <NewAppointmentDialog initialDate={new Date().toLocaleDateString("en-CA", { timeZone: "America/Bogota" })} initialClientId={pet.owner?.id} initialPetId={pet.id} onClose={() => setNewAppointment(false)} onCreated={() => {
        setNewAppointment(false);
        onRecordAdded?.();
        void reloadTimeline().then(setTimeline).catch(() => setError("La cita se creó, pero no se pudo actualizar el historial. Cierra y vuelve a abrir la ficha."));
      }} />}
    </div>
  );
}

export function PetMedicalSheet({ pet, open, onOpenChange, onRecordAdded, initialEdit = false }: PetMedicalSheetProps) {
  const access = useDashboardAccess();
  if (access && !access.capabilities.administration && !access.capabilities.clinical) return <OperationalPetSheet pet={pet} open={open} onOpenChange={onOpenChange} onUpdated={onRecordAdded} />;
  return (
    <ProtectedDialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showClose
        className="flex h-[92vh] w-full max-w-[95vw] flex-col gap-0 overflow-hidden p-0 sm:max-w-5xl"
      >
        {open && pet ? (
          <PetMedicalSheetContent key={`${pet.id}-${initialEdit}`} pet={pet} onRecordAdded={onRecordAdded} initialEdit={initialEdit} />
        ) : null}
      </DialogContent>
    </ProtectedDialog>
  );
}
