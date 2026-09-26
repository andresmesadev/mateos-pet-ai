# Base de datos para desarrollo local

La base PostgreSQL de producción vive en una red privada de Docker en la VPS.
El equipo local usa una base independiente para desarrollar. `backend/.env` y
el `.env` raíz deben apuntar a la base local después de ejecutar el instalador.
Nunca se copian esos archivos a producción.

## Windows

1. Instalar Docker Desktop. La instalación por usuario no requiere elevación,
   pero activar WSL 2 por primera vez sí: en PowerShell **como administrador**,
   ejecutar `wsl --install --no-distribution` y reiniciar Windows si se solicita.
   Iniciar Docker Desktop y comprobar que muestre el motor en ejecución.
2. Desde la raíz del repositorio, ejecutar:

   ```powershell
   pwsh -File scripts/setup-local-db.ps1
   ```

3. Reiniciar el backend (`cd backend; npm run dev`) y mantener el frontend en
   `http://localhost:3010`.
4. Comprobar `http://localhost:3000/api/health`: `services.database` debe ser
   `ok`. Abrir `http://localhost:3010/dashboard/consultas` sin `?preview=1`.

El script inicia `pgvector/pgvector:0.8.6-pg18-bookworm` con volumen persistente
y publica PostgreSQL **solo en 127.0.0.1:5433**. Crea una contraseña aleatoria
en `.env.local-db`, aplica las migraciones versionadas, crea un establecimiento,
servicios, staff y cuatro consultas ficticias. Actualiza `backend/.env` y el
`.env` raíz usado por Prisma, conservando sus valores anteriores en los archivos
`.env.before-local-db` correspondientes. Los archivos de configuración y sus
respaldos son locales e ignorados por Git. No altera la VPS. La base se puede
detener con `docker compose --env-file .env.local-db -f docker-compose.dev.yml down`;
el volumen se conserva.

## Después de reiniciar Windows

1. Abrir Docker Desktop y esperar a que el motor esté activo. El volumen local
   conserva los datos aunque se apague el equipo.
2. Si el contenedor de la base no arranca automáticamente, ejecutar otra vez
   `pwsh -File scripts/setup-local-db.ps1`. El proceso es repetible: no duplica
   clientes, mascotas, servicios ni staff.
3. Iniciar backend y frontend; ejecutar
   `pwsh -File scripts/check-local-dev.ps1` desde la raíz. El diagnóstico
   comprueba Docker, las dos URL de Prisma, frontend, backend y base de datos
   sin mostrar contraseñas.

El seed de consultas solo acepta `127.0.0.1:5433/mateos_dev` y el indicador
`MATEOS_LOCAL_DEV_SEED=1`. Se puede ejecutar de nuevo para actualizar las citas
del día sin duplicar clientes ni mascotas. Los teléfonos ficticios empiezan
por `00000000000`; no son clientes reales.
