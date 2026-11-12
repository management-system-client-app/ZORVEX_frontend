import { api } from "./api";
import type { Fabric } from "./types";

export const STANDARD_FABRICS = [
  "Cotton",
  "Pure Cotton",
  "Poplin",
  "Cambric",
  "Lawn",
  "Voile",
  "Muslin",
  "Silk",
  "Pure Silk",
  "Raw Silk",
  "Georgette",
  "Pure Georgette",
  "Faux Georgette",
  "Poly Georgette",
  "Chiffon",
  "Organza",
  "Satin",
  "Velvet",
  "Net",
  "Soft Net",
  "Hard Net",
  "Tulle",
  "Lace",
  "Crepe",
  "Moss Crepe",
  "Barbie Crepe",
  "Jacquard",
  "Brocade",
  "Jamdani",
  "Linen",
  "Denim",
  "Twill",
  "Canvas",
  "Polyester",
  "Rayon",
  "Viscose",
  "Nylon",
  "Spandex",
  "Lycra",
  "Jersey",
  "Rib Knit",
  "Interlock",
  "Pique",
  "Fleece",
  "Wool",
  "Flannel",
  "Tweed",
  "Cashmere",
  "Corduroy",
  "Taffeta",
  "Tissue",
  "Dobby",
  "Sequins Fabric",
  "Zari Fabric",
  "Topiter",
  "Suede",
  "Leather",
  "Mesh",
  "Terry Cloth",
  "Bamboo Fabric",
  "Hemp",
  "Ramie",
  "Jute",
  "Others",
];

type StandardFabricResult = { fabrics: Fabric[]; error: unknown | null };
let standardFabricRequest: Promise<StandardFabricResult> | null = null;

export function ensureStandardFabrics(): Promise<StandardFabricResult> {
  if (!standardFabricRequest) {
    standardFabricRequest = (async () => {
      const existing = await api.fabrics({ fresh: true });
      const existingNames = new Set(existing.map((fabric) => fabric.name.trim().toLocaleLowerCase()));
      const missing = STANDARD_FABRICS.filter((name) => !existingNames.has(name.toLocaleLowerCase()));
      const results = await Promise.allSettled(
        missing.map((name) => api.createFabric({ name })),
      );
      const fabrics = await api.fabrics({ fresh: true });
      const failed = results.find((result) => result.status === "rejected");
      return {
        fabrics,
        error: failed?.status === "rejected" ? failed.reason : null,
      };
    })();
  }

  const request = standardFabricRequest;
  return request.finally(() => {
    if (standardFabricRequest === request) standardFabricRequest = null;
  });
}
