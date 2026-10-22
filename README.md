# AtlasGrid Logistics v2 — red y tráfico

Primera fase de ampliación de la v1 existente. Conserva su estética, logo, HUD, almacén
procedural, carretillas, inventario físico, acciones y motor de muelles. Añade escala mundial,
una vista regional navegable y tráfico compartido entre la flota y vehículos ambiente.

**8 hubs propios · 30 vehículos de flota · 8 carretillas · 96 vehículos ambiente.**
No es la entrega completa de todas las fases: consulta `CHANGELOG.md` y los pendientes al final.

## Instalación en VS Code

Requisitos: **Node.js 20+**, npm y navegador actual con **WebGL 2**. Pantalla recomendada:
1280 × 800 o superior. Abre la carpeta descomprimida `atlasgrid-v2`, donde está `package.json`.
En **Terminal → Nuevo terminal**, ejecuta:

```bash
npm install
npm run dev
```

Abre la URL de Vite, normalmente **http://127.0.0.1:5173**. Mantén el terminal abierto.
Para parar, `Ctrl+C`. No hacen falta variables de entorno, claves ni backend.

La instalación inicial descarga dependencias de npm. Una vez instaladas, la app funciona
sin Internet con el servidor local: datos, fuentes, geometrías, etiquetas y simulación son
locales. No utiliza APIs, CDN, modelos, imágenes ni texturas remotas. Las fuentes Inter y
JetBrains Mono se empaquetan desde `@fontsource`. No es una PWA instalable ni un ejecutable nativo.

| Comando                | Función                                                 |
| ---------------------- | ------------------------------------------------------- |
| `npm run dev`          | Desarrollo local y recarga automática                   |
| `npm run build`        | TypeScript estricto y build de producción en `dist/`    |
| `npm run preview`      | Abrir el build localmente                               |
| `npm test`             | Vitest: motor, pathfinding, semáforos, stock y guardado |
| `npm run lint`         | ESLint y reglas de hooks                                |
| `npm run format:check` | Comprobar Prettier                                      |
| `npm run verify`       | Lint, build y tests                                     |

## Navegación y primeros pasos

1. La v2 arranca en **Region / Rotterdam**, con un distrito industrial, autopistas, cruces,
   puente sobre un canal, rotonda y conexión al patio. Los coches ambiente empiezan a circular.
2. Pulsa **World**. Los ocho hubs tienen marcadores interactivos; clic en uno abre su región.
   Desde la región, clic en **Enter warehouse** abre el almacén original con su actividad real.
3. El selector superior permite saltar directamente a cualquier almacén. `/` busca hubs,
   camiones, carretillas, pallets y envíos en toda la red.
4. **Fleet** contiene los 30 vehículos. Filtra por estado, hub/destino o tipo. `Locate` centra
   el vehículo; si está en ruta, activa seguimiento en la región o en el mapa mundial.
5. En el inspector puedes pausar/reanudar un vehículo y, durante su aproximación regional,
   solicitar una ruta alternativa. Se conservan sus acciones de muelle, salida y mantenimiento.
6. En **Environment & save** cambia calidad, lluvia o niebla, ciclo solar y contador FPS.
   Exporta la partida JSON, guárdala localmente o carga una exportación de v2.
7. Prueba `×4` o `×8`. El stock cambia al transferir pallets y las nuevas entregas aparecen
   en el tracking. La suma de estados de flota es siempre 30; el tráfico ambiente se cuenta aparte.

## Hubs incluidos

| Hub                   | Ciudad      | Capacidad de pallets | Variante visual |
| --------------------- | ----------- | -------------------- | --------------- |
| Riverside Hub         | Rotterdam   | 60                   | Puerto          |
| Southfield Cross-Dock | Madrid      | 48                   | Cross-dock      |
| Eastport Cold Chain   | Singapore   | 42                   | Frío            |
| Northgate Freight     | Hamburg     | 54                   | Hub             |
| Jade River Terminal   | Shanghai    | 60                   | Terminal        |
| Dune Air Gateway      | Dubai       | 36                   | Gateway         |
| Pacific Crest Hub     | Los Angeles | 48                   | Cross-dock      |
| Verde Logistics Park  | São Paulo   | 30                   | Hub             |

Cada hub tiene inventario, ocupación, reservas, cuatro muelles, dos plazas, cargador y una
carretilla propios. Las regiones comparten la topología base de carreteras. El almacén mantiene
el plano probado de v1; esta fase aún no introduce ocho distribuciones interiores distintas.

## Controles

| Entrada                       | Acción                                            |
| ----------------------------- | ------------------------------------------------- |
| Arrastrar con botón izquierdo | Orbitar con damping                               |
| Arrastrar con botón derecho   | Panorámica; clic derecho en entidad abre acciones |
| Rueda                         | Zoom suave hacia el cursor                        |
| WASD                          | Desplazamiento relativo a la cámara               |
| Q / E                         | Girar                                             |
| R                             | Reset de la cámara de la vista actual             |
| F                             | Seguimiento del camión seleccionado               |
| 1 / 2 / 3 / 4                 | Hub / Mundo / Flota / Región                      |
| Espacio                       | Pausa global / reanudación                        |
| ×1 / ×2 / ×4 / ×8             | Velocidad del motor                               |
| /                             | Búsqueda global                                   |
| Ctrl+K / Cmd+K                | Paleta de comandos                                |
| H                             | Ocultar / mostrar paneles                         |
| Esc                           | Cerrar overlays y limpiar selección               |

Los controles flotantes mantienen zoom, giro, reset, centrado, seguimiento, cubierta y luz.
El minimapa muestra carreteras, tráfico y objetivo de cámara en modo región, o todos los hubs
y vehículos de flota en modo mundial. Sus hubs admiten clic y teclado. La leyenda también
está disponible en Environment & save. Los límites polares evitan bajar bajo el suelo.

## Motor y tráfico

- Tick fijo **10 Hz**, desacoplado del render. El render interpola transformaciones.
- Dijkstra sobre **23 nodos y 52 aristas dirigidas**. Las rutas evitan incidentes vigentes;
  el operador puede excluir el siguiente segmento para tomar una alternativa conectada.
- Carreteras con carriles opuestos, aceleración/frenado, separación longitudinal de 11 m,
  semáforos con fases exclusivas y reservas de cruces. Flota y tráfico ambiente comparten colas.
- Una parte del viaje internacional es una conexión abstracta entre hubs; la aproximación
  final sí usa el grafo regional. No se calculan rutas reales entre continentes.
- El patio conserva waypoints, marcha atrás, reservas y maniobra única por hub. Un vehículo
  solo entra en la puerta si hay destino disponible: no puede cerrar la salida al llenar el patio.
- Los vehículos en espera en un muelle pueden reutilizar su propio muelle para una nueva carga.
  El watchdog de maniobras conserva el camión y su carga si necesita recuperarlo.
- **24 envíos simultáneos como máximo**. Historial acotado a 80 envíos y 80 alertas.
- **265 pallets físicos iniciales**, conservados entre racks, horquillas y vehículos. Ningún
  camión crea mercancía al cargar. Vans: 3 pallets; camiones: 6.
- TRK-01 sigue siendo reserva manual; el generador automático no lo despacha.
- Lluvia y niebla reducen la velocidad. Hay eventos suaves de tráfico/diagnóstico, cierre de
  muelle y batería baja. Una avería aleatoria en ruta se recupera sola; mantenimiento manual
  requiere `Release truck`. El combustible es un indicador operativo, sin economía en esta fase.
- El reloj y las distancias están comprimidos como juego. Las ETAs existentes representan
  el objetivo de entrega; aún no hay un predictor completo de ETA basado en tráfico y clima.
- La simulación se pausa cuando la pestaña queda oculta y limita la recuperación de pausas
  del hilo a 0,5 s, para evitar un pico de trabajo al volver.

## Guardado y compatibilidad

`localStorage` usa **atlasgrid:v2**, sin tocar la partida de v1. Guarda datos, velocidad, hub,
vista, cámara, calidad, cubierta, luz y ciclo solar cada dos segundos. Export/import usa el
mismo formato, con validación de versión, entidades, rutas y ajustes. Las partidas de v1 no
se importan directamente porque corresponden a otro perfil de flota. Archivos inválidos se
rechazan; no sustituyen la partida actual. `Reset simulation` restaura la semilla de v2.

## Estructura del proyecto

| Ruta                                               | Responsabilidad                                                            |
| -------------------------------------------------- | -------------------------------------------------------------------------- |
| `src/sim/engine.ts`                                | Motor original ampliado: estados, transferencias, reservas y acciones      |
| `src/sim/traffic.ts`                               | Tráfico compartido, velocidad, semáforos y reservas de cruces              |
| `src/sim/types.ts`, `kpis.ts`, `math.ts`           | Entidades estrictas, contadores, RNG y helpers                             |
| `src/world/roads.ts`                               | Grafo, Dijkstra, geometría de carril, rotonda y altura del puente          |
| `src/render/RegionScene.tsx`                       | Nueva región procedural                                                    |
| `src/render/TrafficInstances.tsx`                  | Vehículos ambiente instanciados, bounds y suavizado                        |
| `src/render/Weather.tsx`, `PerformanceCounter.tsx` | Lluvia, FPS y actualización limitada de sombras                            |
| `src/scene/`                                       | Componentes de v1 conservados: nave, mundo, vehículos, cámara e inventario |
| `src/ui/`                                          | HUD original, filtros de flota, minimapa y controles de entorno/partida    |
| `src/store/`                                       | Zustand, selección, navegación, acciones y persistencia                    |
| `src/data/seeds.ts`                                | Hubs, SKUs, flota, inventario y estado inicial                             |
| `src/lib/config.ts`                                | Perfil, semilla, límites, velocidades, cámara y paleta                     |
| `tests/`                                           | Pruebas del motor, carreteras y guardados                                  |
| `CHANGELOG.md`                                     | Cambios respecto a v1, agrupados por las siete secciones solicitadas       |
| `VERIFICATION.md`, `verification/`                 | Método, alcance y resultados de comprobación                               |

Se han mantenido `src/scene` y los componentes existentes para ampliar el proyecto sin
reescribirlo. Las nuevas responsabilidades tienen sus módulos `world` y `render` separados.
El motor no importa Three.js, DOM ni React. No hay `any` explícito.

## Añadir hubs, vehículos o empresas

**Nuevo hub:** añade un `Warehouse` a `WAREHOUSES` en `src/data/seeds.ts` con ID, ciudad,
código, capacidad, coordenadas de mapa, temperatura, variante y acento. Añade su cantidad de
stock al array de cantidades iniciales e incrementa `CONFIG.forkliftCount`. Los muelles,
plazas, cargador, carretilla, tráfico y entradas de UI se generan desde esos datos. La nave
actual admite hasta 60 slots; amplía racks antes de superar esa capacidad. Actualiza tests
que verifican el perfil de ocho hubs y reinicia el guardado si cambias el esquema.

**Nuevo vehículo:** cambia `CONFIG.fleetSize` y su semilla. La fábrica genera TRK-05 en adelante;
verifica que sus asignaciones y reservas encajen en los hubs. Un vehículo en plaza o muelle
necesita la reserva recíproca; un pallet en camión necesita `ownerId` y presencia en `cargo`.
Ajusta capacidad según tipo y revalida circulación/colas. El perfil entregado es de 30.

**Empresas:** esta fase conserva una única operadora, AtlasGrid. Las empresas operativas con
propiedad de flota y hubs aún no existen; cambiar un color no equivale a añadir una empresa.
La siguiente extensión debe introducir `Company`, `companyId` en hubs/vehículos/envíos y sus
reglas de propiedad y recogida/entrega, manteniendo las reservas actuales. No hay un botón
funcional para añadir empresas en esta entrega.

## Rendimiento y límites pendientes

- Los 96 vehículos ambiente se simulan, pero solo se dibujan los 12 de la región visible,
  en tres `InstancedMesh`. Los marcadores mundiales usan modelos simplificados; nave y
  región cargan solo sus activos. Vegetación, pallets, racks y vallas usan instancias.
- Sombras: desactivadas en Bajo; Medio usa 1024 px / DPR máximo 1,25; Alto usa 2048 px /
  DPR máximo 1,5. Actualización de sombras limitada a 5 Hz / 10 Hz de simulación.
- Las pruebas en Chromium headless usan renderizado por software. **60 FPS no certificados
  en GPU física**; el contador muestra el rendimiento real del navegador.
- Pendientes: empresas/competidores, almacenes de terceros, layouts interiores independientes,
  stock con valoración/gráficos, Kanban de envíos, turnos, KPIs de coste/CO₂/ingresos,
  feed avanzado, paneles arrastrables, economía, compra/venta, apertura de hubs, Director,
  cámara de cabina, trenes/barcos/aviones operativos, bloom y SSAO.
- Tráfico regulado por grafo; no hay motor de físicas, navegación urbana real ni colisión
  física de carretillas con racks. El peaje es infraestructura visual, sin cobro ni barrera lógica.
- Clima activable; eventos meteorológicos aleatorios y ETA predictiva quedan pendientes.

## Presentación v2.1 (golden hour + HUD en grid)

- **Entorno**: sol bajo con sombras largas, cielo degradado (shader), nubes en movimiento, niebla cálida, césped y hormigón/asfalto en grises medios. Noche opcional sin fondo negro.
- **Postprocesado** (`src/render/Effects.tsx`): N8AO, bloom sutil, ACES, saturación/contraste, viñeteo, SMAA y tilt-shift (Ultra). Calidad Auto/Bajo/Medio/Alto/Ultra; `?q=ultra` fuerza un nivel.
- **HUD** (`src/hud.css`, `src/ui/Zone.tsx`): CSS Grid con zonas reservadas (top 64px, KPIs 300px, inspector 360px, dock ≤220px). Atajos: `K` KPIs, `I` inspector, `T` dock, `H` modo cine, `R` Home (fit-to-bounds).
- **Cámara**: auto-encuadre según aspecto real del viewport (`src/lib/framing.ts`) y límites de objetivo.
- **Camiones**: tractora cab-over y remolque con parabrisas, espejos, faros, ruedas giratorias, puertas, logo y matrícula; furgón mejorado.

## Ciudad viva (fase 3)

- **`src/city/`** (puro y testeable): `profiles.ts` (tema y 5-8 naves de terceros por hub, empresas ficticias en `companies.ts`), `choreography.ts` (ciclo de cada muelle como función pura del tiempo: entra, maniobra en marcha atrás, puerta, carretilla y palés, sale), `schedule.ts` + `collision.ts` (reparto de fases sin solapes entre camiones), `population.ts` (tren, avión, operarios, grúas, cintas) y `scenery.ts` (contenedores, skyline, dunas/colinas).
- **`src/render/city/`**: `CitySites` (naves, cartelería, muelles), `CityLife` (camiones, carretillas, palés, operarios y puertas por InstancedMesh), `PortKit` (canal, grúas pórtico, buque, vía y tren), `AirportKit` (pista, avión, torre, helipuerto), `DistrictKit` (oficinas, silos, torres de refrigeración, autopista elevada, parking, estación EV/combustible, cebras, farolas, marquesinas, horizonte).
- **Temas**: Rotterdam/Hamburgo = puerto; Madrid/São Paulo = polígono industrial; Singapur/Shanghái = puerto con torres; Dubái = cargo aeroportuario; Los Ángeles = autopista elevada y naves robotizadas. Para añadir un hub: entrada en `THEME_BY_HUB` (`profiles.ts`).
- **Tracking**: al seleccionar un camión (o un palé) el panel Shipment Tracking muestra su envío automáticamente.
- **Pruebas**: `?hub=dune&q=high` abre un hub concreto en calidad fija.

## Salto de calidad (fase 4)

- **Pulido visual**: texturas procedurales (césped, hormigón con juntas y grietas), desgaste del asfalto, charcos reflectantes con lluvia, luz cálida de atardecer con sombras neutras, tilt-shift activo por defecto en Ultra, ventanas y charcos de luz de farola de noche.
- **Modo Director (`V`)**: la cámara elige sola planos de los eventos relevantes (camión llegando, muelle de terceros cargando, avión, tren, grúas, alertas). Lógica pura en `src/director/shots.ts`; el título del plano aparece arriba.
- **Modo Foto (`P`)**: oculta el HUD y exporta PNG a 1×/2×/3× con marca de agua AtlasGrid opcional.
- **Capas de datos (`L`)**: congestión viaria y actividad de muelles sobre el mapa 3D, con leyenda.
- **Torre de control**: alertas priorizadas (crítica/aviso/info) con filtros, acción recomendada y «Jump to scene».
- **CI**: `.github/workflows/ci.yml` (lint + build + tests).

### Atajos

`H` modo cine · `V` director · `P` foto · `L` capas · `K/I/T` paneles · `R` home · `Ctrl+K` paleta.
