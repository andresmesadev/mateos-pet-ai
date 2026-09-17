# Excepciones de Agenda — Etapa 5: Esquema físico

**Estado:** diseño completo, listo para aprobación de implementación  
**Precondiciones:** Etapas 1 a 4 aprobadas el 2026-09-17.

## Cambio Prisma

Se añadirá al modelo `Tenant` la relación:

```prisma
agendaExceptions AgendaException[]
```

Y el modelo nuevo:

```prisma
model AgendaException {
  id        String   @id @default(cuid())
  tenantId  String
  tenant    Tenant   @relation(fields: [tenantId], references: [id], onDelete: Cascade)

  scope     String   // "all" | "vet" | "grooming"
  mode      String   // "closed" | "open"
  startDate String   @db.VarChar(10) // YYYY-MM-DD, calendario Bogotá
  endDate   String?  @db.VarChar(10) // inclusiva
  open      String?  @db.VarChar(5)  // HH:mm, solo mode=open
  close     String?  @db.VarChar(5)  // HH:mm, solo mode=open
  reason    String?  @db.VarChar(240)

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@index([tenantId, startDate, endDate])
  @@index([tenantId, scope, startDate, endDate])
}
```

Se usan `String` con longitud acotada para las fechas y horas civiles. Prisma
con `DateTime` representa un instante, mientras que estas reglas deben expresar
un día y una hora locales de Bogotá sin desplazamiento UTC.

## Restricciones SQL de migración

La migración generada por Prisma añadirá constraints PostgreSQL explícitos:

1. `scope IN ('all', 'vet', 'grooming')`.
2. `mode IN ('closed', 'open')`.
3. `endDate IS NULL OR endDate >= startDate`.
4. Para `closed`: `open IS NULL AND close IS NULL`.
5. Para `open`: ambas horas no nulas, con patrón `HH:mm` y `open < close`.
6. `startDate` y `endDate`, cuando exista, con patrón `YYYY-MM-DD`.

La validación de que una fecha exista en el calendario real (por ejemplo,
rechazar `2026-02-30`) queda en el comando de aplicación usando el parser de
fechas de negocio. La restricción física conserva el formato y evita datos de
forma incompatible si una escritura bypassa la ruta HTTP.

## Prevención de solapamientos

Un índice único no resuelve rangos superpuestos. La creación y actualización
se ejecutarán en una transacción serializable que toma un advisory lock de
PostgreSQL por `(tenantId, scope)`. Dentro de la transacción se consulta:

```sql
start_date <= :candidate_end
AND COALESCE(end_date, '9999-12-31') >= :candidate_start
```

Si existe una coincidencia del mismo alcance, se rechaza con
`AgendaExceptionOverlap`. El lock serializa únicamente las escrituras del
mismo establecimiento y alcance: una excepción de veterinaria no bloquea una
de peluquería ni otro tenant.

No se usará un `EXCLUDE` con `daterange`: obligaría a introducir extensiones y
conversiones de fecha que no aportan valor adicional frente al comando
transaccional ya responsable de estas escrituras.

## Consultas e índices

| Operación | Índice utilizado |
| --- | --- |
| Listado administrativo por rango | `[tenantId, startDate, endDate]` |
| Resolver una fecha para un alcance | `[tenantId, scope, startDate, endDate]` |
| Citas afectadas | índice existente de `Appointment [tenantId, date]` |

La resolución consulta en este orden: alcance específico y, si no existe,
alcance global. No necesita un índice nuevo sobre `Appointment`.

## Migración y compatibilidad

1. Crear la migración Prisma para `AgendaException` y su relación con
   `Tenant`.
2. Añadir las constraints SQL en la misma migración.
3. Ejecutar `npx prisma generate` tras el cambio de schema.
4. No hay backfill: ningún tenant necesita una excepción para conservar su
   comportamiento actual.
5. Desplegar la migración antes del backend que la consulta.

La reversión antes de que haya datos consiste en retirar la tabla y sus
constraints. Con datos reales, la reversión requiere exportar las excepciones
primero; nunca se elimina una configuración de operación sin respaldo.

## Validación requerida antes de cierre

- Migración aplicada en una base de prueba limpia.
- Validación de constraints con inserciones inválidas.
- Prueba concurrente de dos comandos para el mismo tenant y alcance.
- `prisma generate` y suite completa de backend.
- Build y lint de frontend.
- Preflight de VPS, backup de la nueva tabla y despliegue con health check.

## Resultado de diseño

Las cinco etapas están completas. La implementación puede comenzar sin
ambigüedad funcional, arquitectónica ni de datos, y conserva los horarios y
citas existentes de todos los tenants.
