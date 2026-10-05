"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Banknote, CheckCircle2, CreditCard, Landmark, Loader2, Plus, Search, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { proxyUrl } from "@/lib/api";
import { tenantQuery, useTenant } from "@/lib/use-tenant";
import { EXPENSE_CATEGORY_LABELS, type ExpenseCategory } from "@/lib/expenses";
import { PAYMENT_METHOD_LABELS, type PaymentMethod } from "@/lib/transactions";
import { formatPosMoney, moneyInCents } from "@/lib/pos-checkout";
import { expenseAmountError, isExpenseRecord, matchesExpense, pendingExpenseKey, readPendingExpense, type ExpenseCommand, type ExpenseRecord, type PendingExpense } from "@/lib/pos-expense";
import { expenseFormDirty } from "@/lib/expense-history";

const METHODS = [{ value: "cash", icon: Banknote }, { value: "transfer", icon: Landmark }, { value: "card", icon: CreditCard }, { value: "other", icon: Wallet }] as const;
const CATEGORIES = Object.keys(EXPENSE_CATEGORY_LABELS) as ExpenseCategory[];
const textareaClass = "block w-full rounded-lg border bg-white px-3 py-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60";
type FieldErrors = Partial<Record<"description" | "responsible" | "amount", string>>;

export function ExpenseForm({ scope, defaultResponsible, onDirtyChange }: { scope: string | null; defaultResponsible: string; onDirtyChange?: (dirty: boolean) => void }) {
  const tenant = useTenant();
  const [category, setCategory] = useState<ExpenseCategory>("supplies");
  const [description, setDescription] = useState("");
  const [responsible, setResponsible] = useState(defaultResponsible);
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState<PaymentMethod>("cash");
  const [notes, setNotes] = useState("");
  const [errors, setErrors] = useState<FieldErrors>({});
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [ready, setReady] = useState(false);
  const [blocked, setBlocked] = useState(false);
  const [pending, setPending] = useState<PendingExpense | null>(null);
  const [candidates, setCandidates] = useState<ExpenseRecord[] | null>(null);
  const [checkedAbsent, setCheckedAbsent] = useState(false);
  const [success, setSuccess] = useState<ExpenseRecord | null>(null);
  const busy = useRef(false);
  const today = new Date().toLocaleDateString("en-CA", { timeZone: "America/Bogota" });
  const cents = moneyInCents(amount);
  const params = new URLSearchParams({ tab: "caja" });
  if (tenant) params.set("tenant", tenant);
  if (success) params.set("date", new Date(success.date).toLocaleDateString("en-CA", { timeZone: "America/Bogota" }));
  const cashHref = `/dashboard/pos?${params}`;
  const dirty = ready && !pending && !blocked && !success && expenseFormDirty({ description, responsible, amount, notes, category, method }, defaultResponsible);
  useEffect(() => { onDirtyChange?.(dirty); }, [dirty, onDirtyChange]);

  useEffect(() => {
    let cancelled = false;
    queueMicrotask(() => {
      if (cancelled) return;
      try {
        const raw = scope ? localStorage.getItem(pendingExpenseKey(scope)) : null;
        if (raw) {
          const restored = readPendingExpense(raw, scope!);
          if (restored) {
            setPending(restored);
            const command = restored.command;
            setCategory(command.category); setDescription(command.description); setResponsible(command.responsible);
            setAmount(String(command.amount)); setMethod(command.paymentMethod); setNotes(command.notes || "");
          } else { setBlocked(true); setError("Hay un intento anterior que no pudimos recuperar. Revisa los gastos en Caja antes de descartarlo."); }
        }
      } catch { setBlocked(true); setError("El navegador no permite conservar el intento de guardado. Habilita su almacenamiento y vuelve a abrir Gastos."); }
      setReady(true);
    });
    return () => { cancelled = true; };
  }, [scope]);

  function forgetPending() {
    if (!scope) throw new Error("No se pudo comprobar el contexto del establecimiento.");
    localStorage.removeItem(pendingExpenseKey(scope));
    setPending(null); setBlocked(false); setCandidates(null); setCheckedAbsent(false);
  }

  function confirmed(row: ExpenseRecord) {
    try { forgetPending(); } catch { setError("El gasto está guardado, pero no pudimos limpiar el aviso local. Revisa Caja antes de registrar otro."); }
    setSuccess(row);
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy.current || pending || blocked || !ready || !scope || success) return;
    const issues: FieldErrors = {};
    if (!description.trim()) issues.description = "Describe en qué se gastó el dinero.";
    if (!responsible.trim()) issues.responsible = "Indica quién registra este gasto.";
    const amountIssue = expenseAmountError(amount);
    if (amountIssue) issues.amount = amountIssue;
    setErrors(issues); setError("");
    if (Object.keys(issues).length) {
      event.currentTarget.querySelector<HTMLInputElement>(`#expense-${Object.keys(issues)[0]}`)?.focus();
      return;
    }
    busy.current = true; setSaving(true);
    const command: ExpenseCommand = { category, description: description.trim(), responsible: responsible.trim(), amount: cents! / 100, paymentMethod: method, notes: notes.trim() || null, date: new Date().toISOString() };
    const attempt: PendingExpense = { version: 1, scope, command };
    try {
      if (localStorage.getItem(pendingExpenseKey(scope))) {
        setBlocked(true); setError("Hay otro intento pendiente en este navegador. Vuelve a abrir Gastos para comprobarlo antes de enviar.");
        busy.current = false; setSaving(false); return;
      }
      localStorage.setItem(pendingExpenseKey(scope), JSON.stringify(attempt));
    }
    catch {
      setError("No se envió el gasto: el navegador no pudo conservar el intento. Revisa su almacenamiento antes de continuar.");
      busy.current = false; setSaving(false); return;
    }
    setPending(attempt);
    try {
      const response = await fetch(proxyUrl(`/api/dashboard/expenses${tenantQuery(tenant)}`), { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(command), signal: AbortSignal.timeout(20_000) });
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        if ([400, 401, 403, 404, 409, 422].includes(response.status)) {
          forgetPending(); setError(payload?.error || "No se pudo registrar el gasto. Revisa los datos y tus permisos."); return;
        }
        throw new Error("Resultado sin confirmar");
      }
      if (!isExpenseRecord(payload) || !matchesExpense(payload, command)) throw new Error("Respuesta incompleta");
      confirmed(payload);
    } catch { setError("No pudimos confirmar el guardado. Comprueba los registros antes de repetir este gasto."); }
    finally { busy.current = false; setSaving(false); }
  }

  async function verify() {
    if (!pending || busy.current) return;
    busy.current = true; setSaving(true); setError(""); setCandidates(null);
    try {
      const day = new Date(pending.command.date).toLocaleDateString("en-CA", { timeZone: "America/Bogota" });
      const query = new URLSearchParams({ from: day, to: day });
      if (tenant) query.set("tenantId", tenant);
      const response = await fetch(proxyUrl(`/api/dashboard/expenses?${query}`), { cache: "no-store", signal: AbortSignal.timeout(20_000) });
      const rows: unknown = await response.json();
      if (!response.ok || !Array.isArray(rows)) throw new Error();
      setCandidates(rows.filter(isExpenseRecord).filter(row => matchesExpense(row, pending.command)));
      if (rows.length >= 500) setError("La consulta alcanzó 500 registros. Revisa también Caja; esta búsqueda puede estar incompleta.");
    } catch { setError("No se pudieron consultar los gastos. Conservamos el intento; vuelve a comprobar cuando haya conexión."); }
    finally { busy.current = false; setSaving(false); }
  }

  function discardAttempt() {
    if (!checkedAbsent || busy.current) return;
    try { forgetPending(); setError(""); } catch { setError("No se pudo limpiar el aviso. Revisa el almacenamiento del navegador."); }
  }

  function startAnother() {
    try { forgetPending(); } catch { return; }
    setSuccess(null); setCategory("supplies"); setDescription(""); setAmount(""); setResponsible(defaultResponsible); setMethod("cash"); setNotes(""); setErrors({}); setError("");
  }
  if (success) return <section aria-label="Gasto guardado" className="mx-auto max-w-2xl space-y-5 rounded-2xl border bg-white p-6 sm:p-8">
    <CheckCircle2 className="h-10 w-10 text-primary" /><div><h3 className="text-xl font-bold">Gasto registrado</h3><p className="mt-1 text-sm text-muted-foreground">{success.status === "voided" ? "Este registro está anulado y no suma a los gastos activos." : "El gasto quedó guardado y aparece en Caja diaria."}</p></div>
    <div className="rounded-xl bg-muted/30 p-5"><p className="text-3xl font-bold tabular-nums">{formatPosMoney(success.amount)}</p><p className="mt-2 break-words font-semibold">{success.description}</p><dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2"><div><dt className="text-muted-foreground">Categoría</dt><dd>{EXPENSE_CATEGORY_LABELS[success.category]}</dd></div><div><dt className="text-muted-foreground">Medio de pago</dt><dd>{PAYMENT_METHOD_LABELS[success.paymentMethod]}</dd></div><div><dt className="text-muted-foreground">Responsable</dt><dd className="break-words">{success.responsible}</dd></div><div><dt className="text-muted-foreground">Fecha registrada</dt><dd>{new Date(success.date).toLocaleString("es-CO", { timeZone: "America/Bogota" })}</dd></div></dl>{success.notes && <p className="mt-4 whitespace-pre-wrap break-words text-sm">{success.notes}</p>}<p className="mt-4 break-all text-xs text-muted-foreground">Registro: {success.id}</p></div>
    {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
    <div className="flex flex-wrap gap-3"><Button asChild><Link href={cashHref}>Ver en caja</Link></Button><Button type="button" variant="outline" onClick={startAnother}><Plus />Registrar otro</Button></div>
  </section>;

  const locked = saving || !!pending || blocked || !ready || !scope;
  return <form noValidate onSubmit={submit} className="space-y-5">
    {!scope && <p role="alert" className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">No se pudo comprobar el establecimiento. Actualiza esta página antes de registrar un gasto.</p>}
    {(pending || blocked) && <section aria-label="Comprobar gasto pendiente" className="space-y-4 rounded-xl border border-amber-200 bg-amber-50 p-5 text-amber-950">
      <div><h3 className="font-semibold">Guardado pendiente de comprobar</h3><p className="mt-1 text-sm">No vuelvas a enviar el gasto hasta revisar si quedó registrado. Este aviso se conserva al salir.</p></div>
      <div className="flex flex-wrap gap-2">{pending && <Button type="button" variant="outline" disabled={saving} onClick={verify}><Search />{saving ? "Comprobando…" : "Comprobar registros"}</Button>}<Button asChild variant="outline"><Link href={cashHref}>Revisar Caja</Link></Button></div>
      {candidates !== null && <div role="status" className="space-y-3 text-sm">{candidates.length ? <><p>Encontramos {candidates.length} {candidates.length === 1 ? "registro coincidente" : "registros coincidentes"}. Revisa los datos antes de seleccionarlo.</p>{candidates.map(row => <div key={row.id} className="rounded-lg border bg-white p-3"><p className="break-words font-semibold">{row.description} · {formatPosMoney(row.amount)}</p><p className="mt-1 break-all text-xs">{row.id} · {row.status === "active" ? "Activo" : "Anulado"}</p><Button type="button" variant="outline" className="mt-2" onClick={() => confirmed(row)}>Este es el registro de mi gasto</Button></div>)}</> : <p>No encontramos coincidencias en esta consulta. Esto no demuestra que el envío haya fallado: revisa Caja antes de descartarlo.</p>}</div>}
      <details className="text-sm"><summary className="cursor-pointer font-semibold">Ya revisé Caja y el gasto no se registró</summary><label className="mt-3 flex items-start gap-2"><input type="checkbox" checked={checkedAbsent} onChange={event => setCheckedAbsent(event.target.checked)} className="mt-1" />Confirmo que revisé los registros y no hay un gasto de este intento.</label><Button type="button" variant="outline" className="mt-3" disabled={!checkedAbsent || saving} onClick={discardAttempt}>Descartar aviso y revisar formulario</Button><p className="mt-2 text-xs">Descartar el aviso no envía otro gasto.</p></details>
    </section>}
    {error && <p role="alert" className="rounded-xl border border-destructive/20 bg-destructive/5 p-4 text-sm text-destructive">{error}</p>}
    <div className="grid items-start gap-6 lg:grid-cols-[1fr_340px]">
      <fieldset disabled={locked} className="min-w-0 space-y-5">
        <section className="rounded-2xl border bg-white p-5 sm:p-6"><h3 className="font-semibold">Datos del gasto</h3><p className="mt-1 text-sm text-muted-foreground">Los campos marcados como obligatorios permiten identificar el gasto.</p><div className="mt-5 grid gap-5 sm:grid-cols-2">
          <div className="sm:col-span-2"><label htmlFor="expense-description" className="mb-2 block text-sm font-medium">Descripción <span className="text-muted-foreground">(obligatoria)</span></label><Input id="expense-description" required maxLength={500} placeholder="Ej. Compra de champú para peluquería" value={description} onChange={event => setDescription(event.target.value)} aria-invalid={!!errors.description} aria-describedby={errors.description ? "expense-description-error" : undefined} />{errors.description && <p id="expense-description-error" className="mt-2 text-xs text-destructive">{errors.description}</p>}</div>
          <div><label htmlFor="expense-responsible" className="mb-2 block text-sm font-medium">Responsable <span className="text-muted-foreground">(obligatorio)</span></label><Input id="expense-responsible" required maxLength={200} value={responsible} onChange={event => setResponsible(event.target.value)} placeholder="Quién registra el gasto" aria-invalid={!!errors.responsible} aria-describedby={errors.responsible ? "expense-responsible-error" : undefined} />{errors.responsible && <p id="expense-responsible-error" className="mt-2 text-xs text-destructive">{errors.responsible}</p>}</div>
          <div><label htmlFor="expense-amount" className="mb-2 block text-sm font-medium">Monto (COP) <span className="text-muted-foreground">(obligatorio)</span></label><Input id="expense-amount" required inputMode="decimal" autoComplete="off" placeholder="Ej. 12500,50" value={amount} onChange={event => setAmount(event.target.value)} aria-invalid={!!errors.amount} aria-describedby="expense-amount-hint expense-amount-error" /><p id="expense-amount-hint" className="mt-2 text-xs text-muted-foreground">Sin puntos de miles. Puedes usar coma o punto decimal.</p>{errors.amount && <p id="expense-amount-error" className="mt-2 text-xs text-destructive">{errors.amount}</p>}</div>
        </div></section>
        <section className="rounded-2xl border bg-white p-5 sm:p-6"><h3 className="mb-4 font-semibold">Categoría del gasto</h3><div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">{CATEGORIES.map(value => <Button key={value} type="button" variant={category === value ? "default" : "outline"} aria-pressed={category === value} onClick={() => setCategory(value)} className="h-auto min-h-11 justify-start whitespace-normal py-3 text-left">{EXPENSE_CATEGORY_LABELS[value]}</Button>)}</div></section>
        <section className="rounded-2xl border bg-white p-5 sm:p-6"><h3 className="font-semibold">Medio utilizado para pagar</h3><p className="mt-1 text-sm text-muted-foreground">Selecciona cómo salió el dinero del negocio.</p><div className="mt-4 grid grid-cols-2 gap-2">{METHODS.map(({ value, icon: Icon }) => <Button key={value} type="button" variant={method === value ? "default" : "outline"} aria-pressed={method === value} onClick={() => setMethod(value)} className="min-h-11"><Icon />{PAYMENT_METHOD_LABELS[value]}</Button>)}</div></section>
        <section className="rounded-2xl border bg-white p-5 sm:p-6"><label htmlFor="expense-notes" className="block font-semibold">Notas <span className="text-sm font-normal text-muted-foreground">(opcionales)</span></label><p className="mb-3 mt-1 text-sm text-muted-foreground">Proveedor, referencia del comprobante y observaciones del gasto.</p><textarea id="expense-notes" rows={4} maxLength={6000} className={textareaClass} placeholder="Ej. Proveedor y número de factura…" value={notes} onChange={event => setNotes(event.target.value)} /><p className="mt-2 text-right text-xs text-muted-foreground">{notes.length}/6000</p></section>
      </fieldset>
      <aside aria-label="Resumen del gasto" className="space-y-5 rounded-2xl border bg-white p-5 lg:sticky lg:top-24 sm:p-6">
        <div><h3 className="font-semibold">Revisa antes de guardar</h3><p className="mt-1 text-sm text-muted-foreground">Este registro se suma a los gastos del día.</p></div>
        <p className="break-words text-3xl font-bold tabular-nums text-rose-700">{formatPosMoney((cents ?? 0) / 100)}</p>
        <dl className="space-y-4 text-sm"><div><dt className="text-muted-foreground">Descripción</dt><dd className="mt-1 break-words font-medium">{description.trim() || "Por completar"}</dd></div><div><dt className="text-muted-foreground">Responsable</dt><dd className="mt-1 break-words">{responsible.trim() || "Por completar"}</dd></div><div><dt className="text-muted-foreground">Categoría</dt><dd>{EXPENSE_CATEGORY_LABELS[category]}</dd></div><div><dt className="text-muted-foreground">Medio de pago</dt><dd>{PAYMENT_METHOD_LABELS[method]}</dd></div><div><dt className="text-muted-foreground">Fecha de registro</dt><dd>{pending ? new Date(pending.command.date).toLocaleDateString("es-CO", { timeZone: "America/Bogota" }) : new Date(`${today}T12:00:00-05:00`).toLocaleDateString("es-CO", { timeZone: "America/Bogota" })}</dd></div></dl>
        <Button type="submit" size="lg" className="w-full" disabled={locked}>{saving ? <Loader2 className="animate-spin" /> : <CheckCircle2 />}{saving ? "Guardando…" : "Registrar gasto"}</Button>
        {dirty && <p role="status" className="text-xs text-amber-800">Datos sin guardar. Registra el gasto antes de salir.</p>}
        <Button asChild variant="outline" className="w-full"><Link href={cashHref}>Volver a caja</Link></Button>
      </aside>
    </div>
  </form>;
}
