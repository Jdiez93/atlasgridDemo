# Changelog

## 2.3
- Modo Director, Modo Foto (PNG con marca de agua), capas de datos, torre de control, texturas procedurales, desgaste de asfalto, charcos, iluminación de noche, CI.

## 2.2
- Ciudad viva: naves de terceros con coreografía determinista, temas por hub, tráfico ambiente ampliado y anti-bloqueo.
- Tracking sigue al camión seleccionado.


Ampliación del proyecto v1 existente. Se mantienen React 18, Vite, TypeScript estricto,
Three/R3F/Drei, Zustand, Tailwind, Lucide, Framer Motion, logo, paleta y layout general.
Esta versión implementa la prioridad inicial de red, escala de flota y tráfico; incorpora
navegación, filtros y herramientas necesarias para utilizar esa escala. No declara completas
las fases de empresas, economía o paneles avanzados.

## 1. Mundo y escala

- Red ampliada de 3 a 8 hubs: Rotterdam, Madrid, Hamburg, Shanghai, Singapore, Dubai,
  Los Angeles y São Paulo. Nuevos nombres originales, capacidades, stocks y acentos.
- Nueva vista Región con distrito industrial, carreteras, autopistas, cruces, semáforos,
  rotonda de sentido único, canal, puente transitable y peaje visual.
- Mundo continental procedural más grande y ocho marcadores; clic abre la región del hub.
  El marcador de la región abre la nave. Selector y búsqueda abarcan toda la red.
- Cámara y zoom ampliados para la nueva escala; transiciones, foco y seguimiento según nivel.
- Pendiente: topologías y layouts interiores completamente independientes por ciudad.

## 2. Empresas y almacenes

- Hubs propios con datos de ocupación independientes, variantes y acentos configurables.
- Edificios industriales procedurales añaden contexto a la región.
- Pendiente: 5–6 empresas con propiedad real, logos, cuotas, panel y transporte a terceros.
  Los edificios del distrito son ambientación, no almacenes operativos de competidores.

## 3. Flota y movimiento

- Flota de 4 a 30 vehículos, incluyendo 7 vans de tres pallets y 23 camiones de seis.
- 8 carretillas y 265 pallets físicos, conservando la lógica probada de v1.
- 96 coches/vans ambiente: 12 por hub, con bucles de circulación y paso por la rotonda/puente.
- Dijkstra determinista: 23 nodos, 52 aristas; alternativas al excluir segmentos con incidentes.
- Flota y ambiente comparten colas, aceleración/frenado, separación de carril y reservas de cruce.
  Semáforos con verdes exclusivos y fases de despeje.
- Corrección del bloqueo por patio lleno: admisión solo con destino disponible y reutilización
  del muelle de un vehículo en espera para la siguiente carga.
- Generador y límites ampliados: 24 envíos simultáneos; 80 envíos y 80 alertas de historial.
- Nuevo indicador de combustible/distancia regional, pausa por vehículo y rutas alternativas.
- Lluvia/niebla activables con efecto real sobre velocidad; ciclo solar automático suave.
- Pendiente: meteorología aleatoria, ETA predictiva, física de carretillas, modos marítimo/aéreo/ferroviario.

## 4. Paneles y claridad

- Flota filtrable por estado, hub/destino y tipo; combustible, velocidad y conteos dinámicos.
- Locate activa seguimiento de vehículos en ruta en el nivel adecuado.
- Inspector de flota con pausa/reanudación y selección de carretera alternativa.
- Minimapa regional/global con flota, tráfico, hubs y objetivo de cámara; navegación por teclado.
- Leyenda accesible, explicaciones de ajustes y ayudas `?` en cabeceras compartidas.
- Tracking/formulario ajustados al límite de red; eliminados badges de cuatro vehículos.
- Pendiente: Stock avanzado/gráfico, Kanban, turnos, KPIs financieros/CO₂, feed filtrable,
  comparativas de sesión y paneles arrastrables con layout persistente.

## 5. Control y juego

- Nueva velocidad ×8; conserva pausa y ×1/×2/×4.
- Pausa independiente de vehículo, ruta alternativa y acciones anteriores de muelle/parking/mantenimiento.
- Save, export/import JSON con validación de esquema, ajustes, rutas y entidades.
- Partida v2 independiente de v1; los datos anteriores no se borran ni se convierten silenciosamente.
- Atajo 4 para Región y ayuda actualizada; se conservan búsqueda y paleta de comandos.
- Pendiente: wizard de varias etapas, economía, compra/venta, apertura de hubs, Director y cabina.

## 6. Calidad visual y rendimiento

- Región low-poly con cubiertas, equipos de techo, docks, vegetación y vehículos procedurales.
- Vegetación instanciada con exclusión de carreteras, edificios, patio y canal.
- Tráfico ambiente en tres instancias por región; bounds explícitos para culling.
- Modelos mundiales simplificados y carga de activos por nivel/hub.
- Partículas de lluvia ligeras, niebla y luces/materiales emisivos.
- Calidad Bajo/Medio/Alto: DPR, resolución y actualización limitada de sombras; contador FPS opcional.
- Nombres accesibles en filtros, controles de minimapa por teclado y HUD responsive conservado.
- Pendiente: bloom/SSAO. Los 60 FPS requieren medir una GPU física; no se certifican en esta entrega.

## 7. Arquitectura y código

- Motor de v1 ampliado, sin sustituirlo por otro ni mover la lógica al render.
- Nuevos módulos `src/world` y `src/render`; se conserva `src/scene` para reutilizar la nave,
  modelos y cámara. Tráfico separado en `src/sim/traffic.ts`.
- Configuración de perfil centralizada en `src/lib/config.ts`; semilla y datos en `src/data/seeds.ts`.
- Tests de Dijkstra, rutas cortadas, semáforos, separación, clima, pausa, red y guardados.
- Pruebas originales adaptadas a la flota ampliada, con duración de 72.000 ticks y varias semillas.
- Validación adicional de rutas/estados al cargar partidas, sin sobrescribir funciones del store.
- README y registros de verificación nuevos; no se incluyen los resultados de duración de v1
  como si correspondieran a v2. Sin nuevas dependencias ni servicios remotos.
