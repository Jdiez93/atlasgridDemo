# Verificación de la v2

La entrega corresponde a la primera fase de ampliación, construida sobre la v1. Se conserva
su nave, inventario, carretillas, motor de patio y HUD. No incluye los resultados de v1 como
prueba de esta versión.

## Comprobaciones automáticas

Antes de empaquetar se ejecutan `npm install`, `npm run build`, `npm run lint`, `npm test`
y `npm run format:check` en el proyecto con dependencias instaladas en su propia carpeta.
Entorno: Node.js 24 / Linux; el requisito de ejecución es Node.js 20+.
Los resultados y versiones se registran en `verification/checks.json`.

La suite reúne **31 pruebas**:

- Estados legales/ilegales y ciclo completo de envío.
- Movimiento y cambio de stock antes de diez segundos.
- Conservación de pallets, reservas, capacidades y suma de 30 estados de flota.
- Acciones de muelle, parking, mantenimiento, carretilla y carga manual.
- Watchdog de maniobras y cancelación de descarga sin duplicar slots.
- Reproducción exacta desde un snapshot, incluida la circulación ambiente.
- Dijkstra, ruta alternativa, acceso cerrado y fases de semáforos exclusivas.
- Frenado ante rojo, separación de carril, lluvia y pausa por vehículo.
- Tráfico ambiente continuo en los ocho hubs.
- Importación de partidas, rechazo de formatos inválidos y seguimiento entre niveles.

La prueba de duración ejecuta **72.000 ticks, 7.200 segundos simulados**, equivalentes a
30 minutos a ×4 o 15 minutos a ×8. Comprueba invariantes periódicamente, separación de patio,
historial acotado y cero recuperaciones del watchdog. Hay recorridos adicionales con cuatro
semillas. Es una prueba acelerada del motor: **no es una sesión de navegador de 30 minutos reales**.

## Comprobación del navegador

Se prueba el servidor `npm run dev` en Chromium headless con WebGL mediante SwiftShader:
primera vista regional, ocho marcadores mundiales, entrada a los ocho hubs, acceso a la nave,
tabla de 30 vehículos, filtros de vans/estado, inspector, seguimiento, pausa/reanudación,
ruta alternativa, lluvia, calidad Baja, FPS, export/import JSON, ×8, restauración y 1280 × 800.
El registro final se incluye en `verification/ui.json`.

El ensayo verifica errores de consola, advertencias y solicitudes externas de la aplicación.
La instalación de npm requiere conexión inicial; los recursos servidos por la aplicación son locales.

## Límites de la evidencia

- SwiftShader utiliza CPU: no permite certificar 60 FPS de una GPU física.
- Las pruebas verifican rutas y separación lógica; no hay motor físico de colisiones.
- No se ha hecho una nueva certificación de fugas GPU durante 30 minutos reales en esta fase.
- No se declara implementada la economía, las empresas ni los paneles avanzados pendientes.

El alcance completo y las limitaciones se enumeran en `README.md` y `CHANGELOG.md`.
