import { SkillLevel } from '../types/enums';
import { Resume } from '../types/resume';

const levelWeights: Record<SkillLevel, number> = {
  [SkillLevel.Beginner]: 1,
  [SkillLevel.Elementary]: 2,
  [SkillLevel.Intermediate]: 3,
  [SkillLevel.Advanced]: 4,
  [SkillLevel.Expert]: 5,
};

const MAX_LEVEL_WEIGHT = 5;
const BONUS_SKILL_RATIO = 0.5;
const PROJECT_MATCH_CAP = 2;

export interface FitBreakdown {
  score: number;
  matchedRequired: string[];
  missingRequired: string[];
  matchedBonus: string[];
  matchedProjects: string[];
}

export function normalizeSkillName(name: string): string {
  return name.trim().toLowerCase();
}

export function parseSkillInput(value: string): string[] {
  const seen = new Set<string>();
  const skills: string[] = [];
  value.split(/[\n,，、;；]/).forEach((chunk) => {
    const name = chunk.trim();
    const key = normalizeSkillName(name);
    if (name && !seen.has(key)) {
      seen.add(key);
      skills.push(name);
    }
  });
  return skills;
}

export function computeFitScore(resume: Resume, requiredSkills: string[], bonusSkills: string[]): FitBreakdown {
  const required = parseSkillInput(requiredSkills.join('\n'));
  const bonus = parseSkillInput(bonusSkills.join('\n'));

  const skillWeights = new Map<string, number>();
  resume.skills.forEach((skill) => {
    const key = normalizeSkillName(skill.name);
    const weight = levelWeights[skill.level] ?? 1;
    skillWeights.set(key, Math.max(skillWeights.get(key) ?? 0, weight));
  });

  const matchedRequired: string[] = [];
  const missingRequired: string[] = [];
  let requiredRaw = 0;
  required.forEach((name) => {
    const weight = skillWeights.get(normalizeSkillName(name));
    if (weight === undefined) {
      missingRequired.push(name);
    } else {
      matchedRequired.push(name);
      requiredRaw += weight;
    }
  });

  const matchedBonus: string[] = [];
  let bonusRaw = 0;
  bonus.forEach((name) => {
    const weight = skillWeights.get(normalizeSkillName(name));
    if (weight !== undefined) {
      matchedBonus.push(name);
      bonusRaw += weight * BONUS_SKILL_RATIO;
    }
  });

  const trackedSkills = [...required, ...bonus].map(normalizeSkillName);
  const matchedProjects: string[] = [];
  let projectRaw = 0;
  resume.projects.forEach((project) => {
    const haystack = [project.name, project.role, project.description, ...project.techStack]
      .join(' ')
      .toLowerCase();
    const hits = trackedSkills.filter((skill) => skill.length > 0 && haystack.includes(skill)).length;
    if (hits > 0) {
      matchedProjects.push(project.name);
      projectRaw += Math.min(hits, PROJECT_MATCH_CAP);
    }
  });

  const maxRaw =
    required.length * MAX_LEVEL_WEIGHT +
    bonus.length * MAX_LEVEL_WEIGHT * BONUS_SKILL_RATIO +
    resume.projects.length * PROJECT_MATCH_CAP;
  const raw = requiredRaw + bonusRaw + projectRaw;
  const score = maxRaw > 0 ? Math.min(100, Math.round((raw / maxRaw) * 100)) : 0;

  return { score, matchedRequired, missingRequired, matchedBonus, matchedProjects };
}

export function isDeadlinePassed(deadline: string, now: Date = new Date()): boolean {
  const endOfDay = new Date(`${deadline}T23:59:59.999`);
  if (Number.isNaN(endOfDay.getTime())) {
    return true;
  }
  return now.getTime() > endOfDay.getTime();
}
