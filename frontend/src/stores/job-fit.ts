import { create } from 'zustand';
import { JobFitProfile } from '../types/job-fit';
import { Resume } from '../types/resume';
import { computeFitScore, isDeadlinePassed, normalizeSkillName } from '../utils/job-fit';
import { createId } from '../utils/format';
import { readStorage, storageKeys, writeStorage } from '../utils/storage';
import { useResumeStore } from './resume';

export interface RegisterJobFitInput {
  resumeId: string;
  position: string;
  deadline: string;
  requiredSkills: string[];
  bonusSkills: string[];
}

export type JobFitActionResult = { ok: true } | { ok: false; reason: string };

function cloneResume(resume: Resume): Resume {
  return JSON.parse(JSON.stringify(resume)) as Resume;
}

function findResume(resumeId: string): Resume | undefined {
  return useResumeStore.getState().resumes.find((resume) => resume.id === resumeId);
}

interface JobFitState {
  profiles: JobFitProfile[];
  registerProfile: (input: RegisterJobFitInput) => JobFitActionResult;
  submitProfile: (profileId: string) => JobFitActionResult;
  withdrawProfile: (profileId: string) => JobFitActionResult;
}

export const useJobFitStore = create<JobFitState>((set, get) => {
  const persist = (profiles: JobFitProfile[]) => {
    set({ profiles });
    writeStorage(storageKeys.jobFitProfiles, profiles);
  };

  return {
    profiles: readStorage<JobFitProfile[]>(storageKeys.jobFitProfiles, []),
    registerProfile: (input) => {
      const position = input.position.trim();
      if (!position) {
        return { ok: false, reason: '请填写岗位名称' };
      }
      if (!input.deadline) {
        return { ok: false, reason: '请选择截止日期' };
      }
      const resume = findResume(input.resumeId);
      if (!resume) {
        return { ok: false, reason: '简历不存在，无法登记' };
      }
      const positionKey = normalizeSkillName(position);
      const duplicated = get().profiles.some(
        (profile) =>
          profile.resumeId === input.resumeId &&
          normalizeSkillName(profile.position) === positionKey &&
          profile.status !== 'withdrawn',
      );
      if (duplicated) {
        return { ok: false, reason: '该岗位已存在未撤回的档案，不能重复登记' };
      }

      const breakdown = computeFitScore(resume, input.requiredSkills, input.bonusSkills);
      const now = new Date().toISOString();
      const profile: JobFitProfile = {
        id: createId('jobfit'),
        resumeId: input.resumeId,
        position,
        deadline: input.deadline,
        requiredSkills: [...input.requiredSkills],
        bonusSkills: [...input.bonusSkills],
        status: 'draft',
        fitScore: breakdown.score,
        matchedRequired: breakdown.matchedRequired,
        missingRequired: breakdown.missingRequired,
        matchedBonus: breakdown.matchedBonus,
        matchedProjects: breakdown.matchedProjects,
        snapshot: null,
        createdAt: now,
        updatedAt: now,
        submittedAt: null,
        withdrawnAt: null,
      };
      persist([profile, ...get().profiles]);
      return { ok: true };
    },
    submitProfile: (profileId) => {
      const profile = get().profiles.find((item) => item.id === profileId);
      if (!profile) {
        return { ok: false, reason: '档案不存在' };
      }
      if (profile.status === 'submitted') {
        return { ok: false, reason: '档案已提交，无需重复提交' };
      }
      if (profile.status === 'withdrawn') {
        return { ok: false, reason: '档案已撤回，如需提交请重新登记' };
      }
      if (isDeadlinePassed(profile.deadline)) {
        return { ok: false, reason: '已过截止日期，不能提交' };
      }
      const resume = findResume(profile.resumeId);
      if (!resume) {
        return { ok: false, reason: '简历不存在，无法提交' };
      }
      const breakdown = computeFitScore(resume, profile.requiredSkills, profile.bonusSkills);
      if (breakdown.missingRequired.length > 0) {
        return { ok: false, reason: `缺少必备技能：${breakdown.missingRequired.join('、')}` };
      }

      const now = new Date().toISOString();
      persist(
        get().profiles.map((item) =>
          item.id === profileId
            ? {
                ...item,
                status: 'submitted' as const,
                fitScore: breakdown.score,
                matchedRequired: breakdown.matchedRequired,
                missingRequired: breakdown.missingRequired,
                matchedBonus: breakdown.matchedBonus,
                matchedProjects: breakdown.matchedProjects,
                snapshot: cloneResume(resume),
                submittedAt: now,
                updatedAt: now,
              }
            : item,
        ),
      );
      return { ok: true };
    },
    withdrawProfile: (profileId) => {
      const profile = get().profiles.find((item) => item.id === profileId);
      if (!profile) {
        return { ok: false, reason: '档案不存在' };
      }
      if (profile.status === 'withdrawn') {
        return { ok: false, reason: '档案已撤回' };
      }
      if (isDeadlinePassed(profile.deadline)) {
        return { ok: false, reason: '已过截止日期，不能撤回' };
      }

      const now = new Date().toISOString();
      persist(
        get().profiles.map((item) =>
          item.id === profileId
            ? { ...item, status: 'withdrawn' as const, withdrawnAt: now, updatedAt: now }
            : item,
        ),
      );
      return { ok: true };
    },
  };
});
