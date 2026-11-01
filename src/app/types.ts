/**
 * Domain model barrel for the Nihiltheism Architect client.
 *
 * The canonical domain contracts live in `shared/types.ts` so that the Express
 * server (`server/services.ts`) and the browser client (`src/app/api.ts`) both
 * compile against one definition. `src/types.ts` is a separate module and is
 * reserved for the epistemic-topology rendering types used by the live
 * visualizer; it must not be merged with this one.
 */
export * from '../../shared/types';
