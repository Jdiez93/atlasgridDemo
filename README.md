# AtlasGrid Logistics

Centro de control logístico en 3D que corre en el navegador. Simula una red de ocho almacenes repartidos por el mundo, con flota propia, carretillas, envíos en curso y una ciudad viva alrededor de cada hub.

> Proyecto de demostración. Todas las empresas, marcas y datos son ficticios.

## Qué es

AtlasGrid pone al usuario en el puesto de operaciones de una empresa de logística. Desde una sola pantalla puede ver el estado de la red, entrar en un almacén, seguir un camión y crear envíos mientras la simulación avanza en tiempo real.

- **8 hubs propios** (Rotterdam, Madrid, Singapur, Hamburgo, Shanghái, Dubái, Los Ángeles y São Paulo).
- **30 vehículos de flota**, **8 carretillas** y tráfico ambiente por las carreteras de cada región.
- **Simulación determinista** con motor de estados para camiones, muelles y carretillas, y vigilancia anti-bloqueo.
- **Interfaz tipo sala de control** con indicadores, inspector, seguimiento de envíos y listado de activos.

## Vistas

| Vista | Qué muestra |
|---|---|
| **World** | La red global con los ocho hubs y los camiones en ruta. |
| **Region** | El hub y su entorno urbano: carreteras, semáforos, naves de terceros, tren y tráfico. |
| **Warehouse** | El interior del almacén: racks, palés, muelles, camiones y carretillas. |
| **Fleet** | Tabla de toda la flota con su estado. |

## Qué se puede hacer

- Seleccionar un camión, una carretilla, un muelle o un palé y consultarlo en el inspector.
- Seguir un envío fase a fase en **Shipment Tracking**. Al seleccionar un camión, el panel muestra su envío automáticamente.
- Crear envíos entre hubs y ver cómo avanzan por la red.
- Pausar la simulación o acelerarla (×1, ×2, ×4, ×8).
- Alternar tejado del almacén, modo noche y clima.
- Buscar cualquier elemento con `/` o con la paleta de comandos `Ctrl+K`.

## Ciudad viva

Cada hub está integrado en una zona urbana reconocible, con su propia ambientación:

- **Rotterdam y Hamburgo**: puerto con canal, grúas pórtico, buque y contenedores apilados.
- **Madrid y São Paulo**: polígono industrial con oficinas, silos y torres de refrigeración.
- **Singapur y Shanghái**: puerto con torres de contenedores y rascacielos al fondo.
- **Dubái**: cargo aeroportuario con pista, avión que despega y aterriza, torre de control, helipuerto y dunas.
- **Los Ángeles**: autopista elevada con tráfico, naves robotizadas y colinas.

Alrededor de cada hub hay entre 5 y 8 naves de otras empresas ficticias (Nordline, Cargovia, Halcyon Retail, Oakridge Market, Sunvale Grocers…). Sus muelles abren y cierran, los camiones entran, maniobran en marcha atrás, cargan o descargan y salen, y hay carretillas, palés y operarios con chaleco. También hay vía de tren con tren de mercancías, aparcamiento de empleados, estación de carga eléctrica, cebras, marquesinas de autobús y semáforos.

## Herramientas de presentación

- **Modo Director (`V`)**: la cámara elige sola planos de los eventos relevantes (camión llegando, muelle cargando, avión, tren, grúas, alertas).
- **Modo Foto (`P`)**: oculta la interfaz y exporta PNG a 1×, 2× o 3× con marca de agua opcional.
- **Capas de datos (`L`)**: congestión de carreteras y actividad de muelles sobre el mapa 3D.
- **Torre de control**: alertas por prioridad (crítica, aviso, info) con filtros, acción recomendada y salto a la escena.
- **Modo cine (`H`)**: oculta todo el HUD.

## Atajos de teclado

| Tecla | Acción |
|---|---|
| `/` · `Ctrl+K` | Buscar · paleta de comandos |
| `1`–`4` | Cambiar de vista |
| `Espacio` | Pausar o reanudar |
| `W A S D` · `Q E` | Mover y rotar la cámara |
| `R` | Volver al encuadre ideal |
| `F` | Seguir el camión seleccionado |
| `K` · `I` · `T` | Mostrar u ocultar KPIs, inspector y dock inferior |
| `H` | Modo cine |
| `V` | Modo Director |
| `P` | Modo Foto |
| `L` | Cambiar capa de datos |

## Gráficos

Todo el entorno es procedural: no se descarga ningún modelo ni textura externa.

- Iluminación de atardecer con sombras suaves, cielo degradado, nubes y niebla.
- Postprocesado con oclusión ambiental, bloom, corrección de color, viñeteo y tilt-shift.
- Ciclo noche opcional con farolas, ventanas y luces de muelle.
- Selector de calidad **Auto / Low / Medium / High / Ultra**. En Auto, la app ajusta el nivel según los FPS medidos.
- Contador de FPS opcional en el panel de ajustes.

## Tecnología

- **React 18** y **TypeScript** estricto
- **Three.js** con **React Three Fiber** y **drei**
- **postprocessing** y **N8AO** para los efectos
- **Zustand** para el estado global
- **Vite** como herramienta de build
- **Tailwind CSS** y **Framer Motion** para la interfaz
- **Vitest** para las pruebas y **ESLint + Prettier** para la calidad del código

## Cómo ejecutarlo

Requisitos: Node.js 20 o superior.

```bash
npm install
npm run dev
```

Abre la dirección que muestra la terminal (por defecto `http://127.0.0.1:5173`).

Parámetros opcionales en la URL:

- `?hub=dune` abre un hub concreto (`riverside`, `southfield`, `eastport`, `northgate`, `jade`, `dune`, `pacific`, `verde`).
- `?q=ultra` fija la calidad (`low`, `medium`, `high` o `ultra`).
- `?night=1` abre la escena de noche.

Se pueden combinar, por ejemplo `?hub=dune&q=high&night=1`.

## Scripts

| Comando | Qué hace |
|---|---|
| `npm run dev` | Servidor de desarrollo |
| `npm run build` | Compilación de producción |
| `npm run preview` | Sirve la compilación |
| `npm test` | Ejecuta las pruebas |
| `npm run lint` | Revisa el código con ESLint |
| `npm run verify` | Lint, build y tests seguidos |

## Estructura

```
src/
├── sim/        Motor de simulación (puro y testeable)
├── city/       Generación procedural de la ciudad y coreografía de las naves
├── director/   Cámara cinematográfica
├── store/      Estado global
├── scene/      Escena del almacén y cámara
├── render/     Escena regional, ciudad, efectos y capas de datos
├── ui/         Paneles, controles y overlays
├── world/      Red viaria y semáforos
├── data/       Datos iniciales
└── lib/        Utilidades
tests/          Pruebas con Vitest
```

## Cómo extender

- **Añadir un hub**: define sus datos en `src/data/seeds.ts` y su tema urbano en `src/city/profiles.ts`.
- **Añadir una empresa ficticia**: agrégala a `src/city/companies.ts`.
- **Cambiar el aspecto de una ciudad**: edita los kits de `src/render/city/`.

## Requisitos del navegador

Un navegador moderno con **WebGL 2** y aceleración por hardware activada. Está pensado para escritorio; en pantallas muy pequeñas la interfaz se vuelve poco práctica.

## Despliegue

Es una aplicación estática. En Vercel basta con importar el repositorio: detecta Vite, usa `npm run build` y publica la carpeta `dist`.

## Licencia

Proyecto de demostración. Añade aquí la licencia que prefieras (por ejemplo, MIT).

### Atajos

`H` modo cine · `V` director · `P` foto · `L` capas · `K/I/T` paneles · `R` home · `Ctrl+K` paleta.
