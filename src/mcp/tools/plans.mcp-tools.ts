import { Injectable } from '@nestjs/common';
import { PlansService } from '../../plans/plans.service';

/**
 * PlansMcpTools
 * ─────────────
 * Stub for now — bulk_create_tasks, get_plans, delete_plan land in Phase 7
 * (spec Section 8 / 10). Wired into McpModule today so the module compiles
 * and the dependency-injection graph is correct from the start; tool
 * methods get added here without touching mcp.module.ts again.
 */
@Injectable()
export class PlansMcpTools {
  constructor(private readonly plansService: PlansService) {}

  // @Tool({ name: 'bulk_create_tasks', ... })  — Phase 7
  // @Tool({ name: 'get_plans', ... })          — Phase 7
  // @Tool({ name: 'delete_plan', ... })        — Phase 7
}