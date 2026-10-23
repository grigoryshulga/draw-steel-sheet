import type { ProjectRow } from "../types";

export interface ProjectProgress {
  points: number;
  goal: number;
  percent: number;
  complete: boolean;
}

export function projectProgress(project: Pick<ProjectRow, "points" | "goal">): ProjectProgress {
  const points = Math.max(0, Math.floor(Number(project.points) || 0));
  const goal = Math.max(0, Math.floor(Number(project.goal) || 0));
  const percent = goal > 0 ? Math.min(100, Math.round((points / goal) * 100)) : 0;

  return {
    points,
    goal,
    percent,
    complete: goal > 0 && points >= goal,
  };
}

export function adjustProjectPoints(points: string, delta: number): string {
  return String(Math.max(0, Math.floor(Number(points) || 0) + delta));
}
