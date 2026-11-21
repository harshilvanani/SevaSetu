import type { Team } from './api';
import { AREA_SKILLS } from './labels';

/** Which of the area's usual skills the active members cover, and which are missing. */
export function teamCoverage(team: Team) {
  const active = team.members.filter((m) => m.status === 'active');
  const wanted = team.seva_area ? (AREA_SKILLS[team.seva_area] ?? []) : [];
  const have = new Set(active.flatMap((m) => m.skills));
  return {
    active: active.length,
    invited: team.members.length - active.length,
    covered: wanted.filter((s) => have.has(s)),
    gaps: wanted.filter((s) => !have.has(s)),
    teachers: active.filter((m) => m.person_type !== 'volunteer').length,
  };
}
