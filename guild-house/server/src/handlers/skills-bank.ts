import { getSkillDetail, getSkillsBankSummary } from "../orchestrator/skills-bank/read";
import type { Config } from "../config";
import type { RoutesSlice } from "../routes";

export function skillsBankRoutes(config: Config): RoutesSlice {
  return {
    "/skills-bank": { GET: async () => Response.json(await getSkillsBankSummary(config)) },
    "/skills-bank/:name": {
      GET: async (req) => {
        try {
          const skill = await getSkillDetail(config, req.params.name);
          if (!skill) return Response.json({ error: "Skill not found" }, { status: 404 });
          return Response.json(skill);
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          return Response.json({ error: message }, { status: 400 });
        }
      },
    },
  };
}
