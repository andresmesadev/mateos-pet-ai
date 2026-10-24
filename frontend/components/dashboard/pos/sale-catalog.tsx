'use client';

import { useCallback, useEffect, useId, useRef, useState } from 'react';
import Link from 'next/link';
import { Loader2, Package, Plus, Search, ShoppingBag } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { proxyUrl } from '@/lib/api';
import { useTenant } from '@/lib/use-tenant';
import type { InventoryProduct } from '@/lib/inventory';
import { formatPosMoney, type CheckoutLine } from '@/lib/pos-checkout';
import { catalogEntries, catalogProductAvailable, catalogServiceLine, exactCatalogProduct, type CatalogFilter, type CatalogService, type CatalogEntry } from '@/lib/pos-catalog-search';

type Products = { scope: string; rows: InventoryProduct[]; next: string | null; loading: boolean; error: string };
type Services = { scope: string; rows: CatalogService[]; loading: boolean; error: string };
type Props = { filter: CatalogFilter; productsEnabled: boolean; servicesEnabled: boolean; petId: string; petName?: string; additional: boolean;
  quantities: Record<string, number>; focusRequest: number; refreshRequest: number; disabled: boolean;
  onProduct: (product: InventoryProduct) => boolean | void; onService: (line: CheckoutLine) => boolean | void };

export function SaleCatalog(props: Props) {
  const tenant = useTenant(), resultsId = useId();
  const input = useRef<HTMLInputElement>(null);
  const latest = useRef(props);
  const scan = useRef<string | null>(null);
  const [query, setQuery] = useState(''), [browsing, setBrowsing] = useState(false), [page, setPage] = useState('');
  const [active, setActive] = useState<string | null>(null), [message, setMessage] = useState('');
  const [products, setProducts] = useState<Products>({ scope: '', rows: [], next: null, loading: false, error: '' });
  const [services, setServices] = useState<Services>({ scope: '', rows: [], loading: false, error: '' });
  const [productRetry, setProductRetry] = useState(0), [serviceRetry, setServiceRetry] = useState(0);
  const visible = browsing || !!query.trim();
  const showProducts = props.productsEnabled && props.filter !== 'services';
  const showServices = props.servicesEnabled && props.filter !== 'products';
  const productScope = JSON.stringify([tenant, query.trim(), page, props.refreshRequest]);
  const serviceScope = JSON.stringify([tenant, props.petId, props.additional]);
  useEffect(() => { latest.current = props; }, [props]);
  useEffect(() => { if (props.focusRequest) input.current?.focus(); }, [props.focusRequest]);
  useEffect(() => { scan.current = null; }, [props.filter, tenant, props.petId]);

  const choose = useCallback((entry: CatalogEntry) => {
    const context = latest.current;
    if (context.disabled) return;
    const accepted = entry.kind === 'product'
      ? catalogProductAvailable(entry.product, context.quantities) && context.onProduct(entry.product) !== false
      : context.onService(catalogServiceLine(entry.service, context.petId, context.petName ?? '')) !== false;
    if (!accepted) { setMessage('No se agregó el artículo. Revisa su disponibilidad y el carrito.'); input.current?.focus(); return; }
    scan.current = null; setQuery(''); setBrowsing(false); setPage(''); setActive(null);
    setMessage(`${entry.kind === 'product' ? entry.product.name : entry.service.name} agregado al carrito.`);
    input.current?.focus();
  }, []);

  useEffect(() => {
    if (!visible || !showProducts) return;
    const abort = new AbortController();
    const timer = setTimeout(async () => {
      setProducts({ scope: productScope, rows: [], next: null, loading: true, error: '' });
      try {
        const params = new URLSearchParams({ use: 'retail', search: query.trim(), limit: '12' });
        if (tenant) params.set('tenantId', tenant); if (page) params.set('cursor', page);
        const response = await fetch(proxyUrl(`/api/dashboard/inventory/products?${params}`), { cache: 'no-store', signal: abort.signal });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error ?? 'No se pudieron cargar los productos.');
        if (abort.signal.aborted) return;
        setProducts({ scope: productScope, rows: data.data, next: data.nextCursor, loading: false, error: '' });
        if (scan.current === productScope) {
          scan.current = null;
          const exact = exactCatalogProduct(data.data, query);
          if (exact) choose({ kind: 'product', key: `product:${exact.id}`, product: exact });
          else setMessage('No hay un código exacto. Selecciona un resultado para agregarlo.');
        }
      } catch (cause) {
        if (!abort.signal.aborted) { scan.current = null; setProducts({ scope: productScope, rows: [], next: null, loading: false, error: cause instanceof Error ? cause.message : 'Catálogo de productos no disponible.' }); }
      }
    }, 200);
    return () => { clearTimeout(timer); abort.abort(); };
  }, [visible, showProducts, productScope, query, tenant, page, productRetry, choose]);

  useEffect(() => {
    if (!visible || !showServices) return;
    const abort = new AbortController();
    const timer = setTimeout(async () => {
      setServices({ scope: serviceScope, rows: [], loading: true, error: '' });
      try {
        const params = new URLSearchParams();
        if (tenant) params.set('tenantId', tenant); if (props.petId) params.set('petId', props.petId); if (props.additional) params.set('additional', '1');
        const response = await fetch(proxyUrl(`/api/dashboard/cash/catalog?${params}`), { cache: 'no-store', signal: abort.signal });
        if (!response.ok) throw new Error('No se pudieron cargar los servicios.');
        const rows = await response.json();
        if (!abort.signal.aborted) setServices({ scope: serviceScope, rows, loading: false, error: '' });
      } catch {
        if (!abort.signal.aborted) setServices({ scope: serviceScope, rows: [], loading: false, error: 'No se pudieron cargar los servicios.' });
      }
    }, 0);
    return () => { clearTimeout(timer); abort.abort(); };
  }, [visible, showServices, serviceScope, tenant, props.petId, props.additional, serviceRetry]);

  const productRows = showProducts && products.scope === productScope ? products.rows : [];
  const serviceRows = showServices && services.scope === serviceScope ? services.rows : [];
  const entries = catalogEntries(productRows, serviceRows, query, props.filter);
  const activeIndex = Math.max(0, entries.findIndex(entry => entry.key === active));
  const busy = visible && ((showProducts && (products.scope !== productScope || products.loading)) || (showServices && (services.scope !== serviceScope || services.loading)));
  const productError = showProducts && products.scope === productScope ? products.error : '';
  const serviceError = showServices && services.scope === serviceScope ? services.error : '';
  const placeholder = props.filter === 'services' ? 'Busca un servicio' : props.filter === 'products' ? 'Nombre, código o barras del producto' : 'Busca productos o servicios, o escanea un código';

  function changeQuery(value: string) { scan.current = null; setQuery(value); setBrowsing(false); setPage(''); setActive(null); setMessage(''); }
  return <section className="space-y-3" aria-label="Catálogo para agregar a la venta">
    <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
      <label htmlFor="pos-catalog-search" className="block min-w-0 flex-1 text-sm font-semibold">Buscar artículo
        <span className="relative mt-2 block"><Search aria-hidden="true" className="pointer-events-none absolute left-3 top-3.5 size-4 text-muted-foreground" />
          <Input ref={input} id="pos-catalog-search" value={query} disabled={props.disabled} autoFocus autoComplete="off" placeholder={placeholder} className="h-12 bg-white pl-10"
            role="combobox" aria-autocomplete="list" aria-controls={resultsId} aria-expanded={visible} aria-activedescendant={visible && entries[activeIndex] ? `${resultsId}-${entries[activeIndex].key}` : undefined}
            onChange={event => changeQuery(event.target.value)} onKeyDown={event => {
              if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); changeQuery(''); }
              if (event.key === 'ArrowDown' || event.key === 'ArrowUp') { event.preventDefault(); if (entries.length) { const current = entries.findIndex(entry => entry.key === active); const next = current < 0 ? (event.key === 'ArrowDown' ? 0 : entries.length - 1) : (current + (event.key === 'ArrowDown' ? 1 : -1) + entries.length) % entries.length; setActive(entries[next].key); document.getElementById(`${resultsId}-${entries[next].key}`)?.scrollIntoView({ block: 'nearest' }); } }
              if (event.key === 'Enter') {
                event.preventDefault();
                if (busy || !entries.length) { if (showProducts && query.trim()) { scan.current = productScope; setProductRetry(value => value + 1); setMessage('Comprobando el código…'); } return; }
                const exact = exactCatalogProduct(productRows, query);
                choose(exact ? { kind: 'product', key: `product:${exact.id}`, product: exact } : entries[activeIndex]);
              }
            }} />
        </span>
      </label>
      <Button type="button" variant="outline" className="h-12 shrink-0" disabled={props.disabled} aria-expanded={visible} aria-controls={resultsId} onClick={() => { const next = !visible; changeQuery(''); setBrowsing(next); input.current?.focus(); }}>{visible ? 'Ocultar catálogo' : 'Ver catálogo'}</Button>
    </div>
    <p className="text-xs text-muted-foreground">Busca por nombre{showProducts ? ', código o barras' : ''}. Usa ↑ ↓ y Enter para agregar.</p>
    {visible && <>
      {busy && <p role="status" className="flex items-center gap-2 text-sm"><Loader2 className="size-4 animate-spin" />Buscando artículos…</p>}
      {productError && <div role="alert" className="text-sm text-red-800">{productError}<Button type="button" variant="outline" size="sm" className="ml-2" onClick={() => setProductRetry(value => value + 1)}>Reintentar productos</Button></div>}
      {serviceError && <div role="alert" className="text-sm text-red-800">{serviceError}<Button type="button" variant="outline" size="sm" className="ml-2" onClick={() => setServiceRetry(value => value + 1)}>Reintentar servicios</Button></div>}
      <div id={resultsId} role="listbox" aria-label="Productos y servicios encontrados" className="max-h-80 space-y-1 overflow-y-auto">
        {entries.map((entry, index) => {
          const product = entry.kind === 'product' ? entry.product : null, service = entry.kind === 'service' ? entry.service : null;
          const disabled = props.disabled || !!(product && !catalogProductAvailable(product, props.quantities));
          const Icon = product ? Package : ShoppingBag;
          return <button key={entry.key} id={`${resultsId}-${entry.key}`} type="button" role="option" aria-selected={activeIndex === index} disabled={disabled} onFocus={() => setActive(entry.key)} onClick={() => choose(entry)} className={`flex min-h-16 w-full items-center gap-3 rounded-xl border px-3 py-3 text-left disabled:opacity-50 ${activeIndex === index ? 'border-primary bg-accent' : 'border-transparent hover:bg-muted'}`}>
            <Icon aria-hidden="true" className="size-5 shrink-0 text-primary" />
            <span className="min-w-0 flex-1"><strong className="block break-words text-sm">{product?.name ?? service?.name}</strong>
              <span className="block break-words text-xs text-muted-foreground">{product ? `Producto · ${product.internalCode} · ${product.presentation}` : `Servicio · ${service?.category === 'grooming' ? 'Peluquería' : service?.category === 'veterinary' ? 'Veterinaria' : 'Otros'}`}</span>
              {product && <span className="block text-xs text-muted-foreground">{product.available} disponibles{props.quantities[product.id] ? ` · ${props.quantities[product.id]} en carrito` : ''}</span>}
              {service && ['pet_agreed_price', 'pet_default_price'].includes(service.priceSource) && <span className="block text-xs text-primary">Tarifa de {props.petName || 'la mascota'}</span>}
            </span>
            <strong className="shrink-0 text-sm tabular-nums">{product ? product.salePrice ? formatPosMoney(product.salePrice) : 'Sin precio' : service?.price ? formatPosMoney(service.price) : 'Definir precio'}</strong><Plus aria-hidden="true" className="size-4 shrink-0 text-primary" />
          </button>;
        })}
      </div>
      {!busy && !entries.length && !productError && !serviceError && <p className="py-2 text-sm text-muted-foreground">No hay artículos para esta búsqueda.</p>}
      {showProducts && products.scope === productScope && !products.loading && !productError && !productRows.length && <div className="space-y-1 text-xs text-muted-foreground"><p>Para vender un producto, configura su uso Venta y precio de venta en Inventario. Puede conservar también Veterinaria o Peluquería.</p><Link href={`/dashboard/inventory${tenant ? `?tenant=${encodeURIComponent(tenant)}` : ''}`} className="inline-flex min-h-11 items-center font-semibold text-primary underline underline-offset-4">Revisar producto en Inventario</Link></div>}
      {showProducts && products.scope === productScope && <div className="flex flex-wrap gap-2">{products.next && <Button type="button" size="sm" variant="outline" disabled={busy || props.disabled} onClick={() => { scan.current = null; setPage(products.next!); setActive(null); }}>Ver siguientes productos</Button>}{page && <Button type="button" size="sm" variant="ghost" disabled={props.disabled} onClick={() => { scan.current = null; setPage(''); setActive(null); }}>Volver al inicio de productos</Button>}</div>}
    </>}
    {message && <p role="status" className="text-sm font-medium text-primary">{message}</p>}
  </section>;
}
