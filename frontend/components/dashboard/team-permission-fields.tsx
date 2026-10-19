"use client";
import { Button } from '@/components/ui/button';

type Props = {
  role: string;
  selected: string[];
  onChange: (permissions: string[]) => void;
  activeModules?: string[];
  disabled?: boolean;
};

export function TeamPermissionFields({ role, selected, onChange, activeModules, disabled = false }: Props) {
  if (role === 'admin') return <p className="rounded-xl border bg-muted/30 p-4 text-sm text-muted-foreground">Administrador: acceso completo a las áreas habilitadas, Caja y configuración del equipo.</p>;

  const complete = selected.includes('administration');
  const areaEnabled = (area: string) => !activeModules || activeModules.includes(area);
  const options = [
    { id: 'cash', label: 'Caja operativa', detail: 'Cobrar y revisar movimientos de hoy; sin egresos, comisiones ni reportes generales.', enabled: true },
    { id: 'appointment_price', label: 'Ajustar precio de una cita', detail: 'Solo citas abiertas; no modifica las tarifas del catálogo ni de futuras visitas.', enabled: areaEnabled('veterinary') || areaEnabled('grooming') },
  ];
  if (['vet', 'groomer'].includes(role)) options.push({ id: 'inventory_consume', label: 'Registrar insumos utilizados', detail: 'Descontar unidades de su área en una atención o con un motivo. No permite modificar costos, precios, entradas ni ajustes.', enabled: areaEnabled(role === 'vet' ? 'veterinary' : 'grooming') });

  return <fieldset disabled={disabled} className="space-y-4 rounded-xl border bg-muted/30 p-4">
    <legend className="px-2 text-sm font-semibold">Perfil y permisos</legend>
    <p className="text-sm text-muted-foreground">Conserva su perfil profesional. Elige el acceso que tendrá al ingresar.</p>
    <div role="group" aria-label="Nivel de acceso" className="flex flex-wrap gap-2">
      <Button type="button" variant={!complete ? 'default' : 'outline'} aria-pressed={!complete} onClick={() => onChange(selected.filter(p => p !== 'administration'))}>Permisos del perfil</Button>
      <Button type="button" variant={complete ? 'default' : 'outline'} aria-pressed={complete} onClick={() => onChange([...new Set([...selected, 'administration'])])}>Acceso completo al dashboard</Button>
    </div>
    {complete ? <p role="status" className="rounded-xl border border-teal-200 bg-teal-50 p-3 text-sm text-teal-950">Acceso de administrador: puede gestionar equipo, configuración, precios, Caja y reportes de este establecimiento. Su título profesional se conserva. Los permisos individuales quedan guardados para cuando retires el acceso completo.</p> : <p className="text-sm text-muted-foreground">Incluye las funciones de su perfil. Puedes agregar estas habilitaciones:</p>}
    {!complete && options.map(option => {
      const implicit = role === 'receptionist' && option.id === 'cash';
      return <label key={option.id} className="flex items-start gap-3 text-sm">
        <input type="checkbox" className="mt-1 h-4 w-4 shrink-0 accent-teal-700" checked={complete || implicit || selected.includes(option.id)} disabled={disabled || complete || implicit || !option.enabled} onChange={event => onChange(event.target.checked ? [...new Set([...selected, option.id])] : selected.filter(p => p !== option.id))} />
        <span><span className="font-semibold">{option.label}{implicit ? ' · incluida en Recepción' : ''}</span><span className="mt-1 block text-muted-foreground">{option.detail}{!option.enabled ? ' Su área está deshabilitada en el establecimiento.' : ''}</span></span>
      </label>;
    })}
  </fieldset>;
}
