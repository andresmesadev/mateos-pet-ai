# Observación finita de salud en la VPS

La captura reutiliza `scripts/observe-production.cjs`: una muestra pública cada cinco minutos durante 48 horas. Registra únicamente salud, versión, tiempos y estado del worker. No inicia la aplicación, usa credenciales, consulta clientes ni envía WhatsApp. El workflow externo horario conserva su función de alerta independiente.

## Instalación de una ventana

Preparar en la VPS un paquete con el observador, `scripts/run-stability-window.sh`, `scripts/install-stability-service.sh` y `deploy/systemd/mateos-pet-ai-stability.service`. Revisar sus huellas contra las fuentes locales antes de considerar válida la instalación. Reutilizar la imagen backend local por su identificador SHA-256; no descargar ni reconstruir imágenes para observar.

```bash
bash scripts/install-stability-service.sh \
  sha256:IDENTIFICADOR_COMPLETO_DE_LA_IMAGEN \
  VERSION \
  ventana-VERSION-YYYYMMDDTHHMMSSZ
```

Sustituir los ejemplos por la imagen y versión comprobadas. El instalador rechaza imagen/versión/ventana mal formadas, ventana existente, contenedor existente o servicio activo. No sobrescribe evidencias ni reinicia backend/frontend. El contenedor no recibe entorno de producción, socket Docker, volúmenes de la aplicación ni puertos publicados; tiene raíz de solo lectura, límites de recursos y solo monta el script de lectura y la carpeta de evidencia.

Fuentes instaladas: `/opt/mateos-pet-ai-observer/scripts/`; configuración sin secretos: `/etc/mateos-pet-ai/stability.conf`; datos: `/var/lib/mateos-pet-ai/stability/`. Requiere el usuario operativo `ubuntu`, Docker y systemd de la instalación actual.

## Seguimiento

```bash
systemctl show mateos-pet-ai-stability.service \
  --property=ActiveState,SubState,Result,ExecMainStartTimestamp,ExecMainStatus
journalctl -u mateos-pet-ai-stability.service --no-pager -n 8
```

Revisar también el archivo JSONL y su última muestra. Un servicio `active` no acredita muestras sanas; un proceso finalizado no acredita 48 horas. El resumen final distingue `incomplete`, `incident` y `health_window_passed`; fija además la versión esperada para impedir que una ventana íntegra de otra versión certifique esta publicación.

Para resumir sin alterar el archivo, montar el mismo script y carpeta en un contenedor desechable con la imagen fijada en la configuración, ejecutar Node con `--summarize /workspace/.cache/stability/ARCHIVO.jsonl --hours 48 --interval-seconds 300 --expected-version VERSION` y conservar su código de salida. No cargar credenciales ni arrancar el backend para esa lectura.

## Interrupciones y finalización

La captura sigue aunque se cierre el PC o SSH. Es finita, sin reinicio automático ni habilitación al arrancar el host: un reboot o interrupción conserva el parcial y obliga a investigar antes de elegir otra ventana. Para detenerla de forma deliberada usar `sudo systemctl stop mateos-pet-ai-stability.service`; documentar que la ventana quedó incompleta.

El archivo se abre de forma exclusiva y se sincroniza después de cada muestra. Ni una reejecución del servicio ni el instalador eliminan archivos anteriores. No modificar el observador instalado mientras haya una ventana activa. Tras finalizar, preservar archivo, resumen y configuración de esa ventana antes de instalar otra.

Un reinicio del worker, cambio de versión o fallo observado impide certificar una ventana limpia. Esta captura no detecta por sí sola toda pérdida de mensajes, errores entre muestras, entregas de WhatsApp o capacidad bajo carga. Antes de cerrar estabilidad, contrastar también cola, recibos, logs, tráfico representativo e incidentes con el [procedimiento del piloto](INTERNAL_PILOT_RUNBOOK.md).
