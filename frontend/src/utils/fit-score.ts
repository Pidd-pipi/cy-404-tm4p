import { Resume } from '../types/resume';

export interface FitScoreBreakdown {
  score: number;
  matchedRequiredSkills: string[];
  missingRequiredSkills: string[];
  matchedBonusSkills: string[];
  missingBonusSkills: string[];
  projectCount: number;
  countedProjects: number;
}

const REQUIRED_SKILL_POINTS = 12;
const BONUS_SKILL_POINTS = 6;
const PROJECT_POINTS = 5;
const MAX_COUNTED_PROJECTS = 3;

export function normalizeSkillName(name: string): string {
  return name.trim().toLowerCase();
}

/**
 * 按技能等级与项目计算适配分：
 * - 每个必备技能满分 12 分，按熟练度（1-5）折算；
 * - 每个加分技能满分 6 分，按熟练度折算；
 * - 项目经历每个 5 分，最多计 3 个；
 * - 最终得分 = 实得分 / 满分 × 100，四舍五入取整。
 */
export function computeFitScore(
  resume: Resume,
  requiredSkills: string[],
  bonusSkills: string[],
): FitScoreBreakdown {
  const findProficiency = (name: string): number | null => {
    const target = normalizeSkillName(name);
    const skill = resume.skills.find((item) => normalizeSkillName(item.name) === target);
    return skill ? skill.proficiency : null;
  };

  let earned = 0;
  let possible = 0;

  const matchedRequiredSkills: string[] = [];
  const missingRequiredSkills: string[] = [];
  requiredSkills.forEach((name) => {
    possible += REQUIRED_SKILL_POINTS;
    const proficiency = findProficiency(name);
    if (proficiency === null) {
      missingRequiredSkills.push(name);
    } else {
      matchedRequiredSkills.push(name);
      earned += (REQUIRED_SKILL_POINTS * proficiency) / 5;
    }
  });

  const matchedBonusSkills: string[] = [];
  const missingBonusSkills: string[] = [];
  bonusSkills.forEach((name) => {
    possible += BONUS_SKILL_POINTS;
    const proficiency = findProficiency(name);
    if (proficiency === null) {
      missingBonusSkills.push(name);
    } else {
      matchedBonusSkills.push(name);
      earned += (BONUS_SKILL_POINTS * proficiency) / 5;
    }
  });

  const countedProjects = Math.min(resume.projects.length, MAX_COUNTED_PROJECTS);
  possible += PROJECT_POINTS * MAX_COUNTED_PROJECTS;
  earned += PROJECT_POINTS * countedProjects;

  const score = possible === 0 ? 0 : Math.min(100, Math.round((earned / possible) * 100));

  return {
    score,
    matchedRequiredSkills,
    missingRequiredSkills,
    matchedBonusSkills,
    missingBonusSkills,
    projectCount: resume.projects.length,
    countedProjects,
  };
}
