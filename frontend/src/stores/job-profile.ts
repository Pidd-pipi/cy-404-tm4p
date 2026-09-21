import dayjs from 'dayjs';
import { create } from 'zustand';
import { JobProfile } from '../types/job-profile';
import { Resume } from '../types/resume';
import { computeFitScore } from '../utils/fit-score';
import { createId } from '../utils/format';
import { readStorage, storageKeys, writeStorage } from '../utils/storage';
import { useResumeStore } from './resume';

export interface RegisterJobProfileInput {
  resumeId: string;
  jobTitle: string;
  company: string;
  deadline: string;
  requiredSkills: string[];
  bonusSkills: string[];
}

export type JobProfileActionResult = { ok: true; profileId: string } | { ok: false; reason: string };

/** 截止日当日 23:59:59 之后视为已过期 */
export function isJobProfileExpired(deadline: string, now: dayjs.Dayjs = dayjs()): boolean {
  return dayjs(deadline).endOf('day').isBefore(now);
}

function normalizeJobTitle(title: string): string {
  return title.trim().toLowerCase();
}

function persist(profiles: JobProfile[]): void {
  writeStorage(storageKeys.jobProfiles, profiles);
}

interface JobProfileState {
  profiles: JobProfile[];
  registerProfile: (input: RegisterJobProfileInput) => JobProfileActionResult;
  submitProfile: (profileId: string) => JobProfileActionResult;
  withdrawProfile: (profileId: string) => JobProfileActionResult;
}

export const useJobProfileStore = create<JobProfileState>((set, get) => ({
  profiles: readStorage<JobProfile[]>(storageKeys.jobProfiles, []),
  registerProfile: (input) => {
    const jobTitle = input.jobTitle.trim();
    if (!jobTitle) {
      return { ok: false, reason: '请填写岗位名称' };
    }
    if (!input.deadline) {
      return { ok: false, reason: '请选择截止日期' };
    }

    const resumeExists = useResumeStore.getState().resumes.some((resume) => resume.id === input.resumeId);
    if (!resumeExists) {
      return { ok: false, reason: '关联简历不存在' };
    }

    // 同简历同岗位只允许存在一份未撤回的档案
    const duplicated = get().profiles.some(
      (profile) =>
        profile.resumeId === input.resumeId &&
        profile.status !== 'withdrawn' &&
        normalizeJobTitle(profile.jobTitle) === normalizeJobTitle(jobTitle),
    );
    if (duplicated) {
      return { ok: false, reason: '该岗位已存在未撤回的档案，请先撤回后再重新登记' };
    }

    const profile: JobProfile = {
      id: createId('job'),
      resumeId: input.resumeId,
      jobTitle,
      company: input.company.trim(),
      deadline: input.deadline,
      requiredSkills: input.requiredSkills,
      bonusSkills: input.bonusSkills,
      status: 'draft',
      fitScore: null,
      missingRequiredSkills: [],
      snapshot: null,
      createdAt: new Date().toISOString(),
      submittedAt: null,
      withdrawnAt: null,
    };

    const profiles = [profile, ...get().profiles];
    set({ profiles });
    persist(profiles);
    return { ok: true, profileId: profile.id };
  },
  submitProfile: (profileId) => {
    const profile = get().profiles.find((item) => item.id === profileId);
    if (!profile) {
      return { ok: false, reason: '档案不存在' };
    }
    if (profile.status !== 'draft') {
      return { ok: false, reason: '只有草稿状态的档案可以提交' };
    }
    if (isJobProfileExpired(profile.deadline)) {
      return { ok: false, reason: '已过截止日期，无法提交' };
    }

    const resume = useResumeStore.getState().resumes.find((item) => item.id === profile.resumeId);
    if (!resume) {
      return { ok: false, reason: '关联简历不存在' };
    }

    const breakdown = computeFitScore(resume, profile.requiredSkills, profile.bonusSkills);
    if (breakdown.missingRequiredSkills.length > 0) {
      return { ok: false, reason: `缺少必备技能：${breakdown.missingRequiredSkills.join('、')}` };
    }

    // 提交即冻结简历快照与适配分，后续编辑简历不改写本档案
    const snapshot = JSON.parse(JSON.stringify(resume)) as Resume;
    const submitted: JobProfile = {
      ...profile,
      status: 'submitted',
      fitScore: breakdown.score,
      missingRequiredSkills: breakdown.missingRequiredSkills,
      snapshot,
      submittedAt: new Date().toISOString(),
    };

    const profiles = get().profiles.map((item) => (item.id === profileId ? submitted : item));
    set({ profiles });
    persist(profiles);
    return { ok: true, profileId };
  },
  withdrawProfile: (profileId) => {
    const profile = get().profiles.find((item) => item.id === profileId);
    if (!profile) {
      return { ok: false, reason: '档案不存在' };
    }
    if (profile.status === 'withdrawn') {
      return { ok: false, reason: '档案已撤回' };
    }
    if (isJobProfileExpired(profile.deadline)) {
      return { ok: false, reason: '已过截止日期，无法撤回' };
    }

    // 撤回仅改变状态，档案保留为历史记录，同岗位可重新登记
    const withdrawn: JobProfile = {
      ...profile,
      status: 'withdrawn',
      withdrawnAt: new Date().toISOString(),
    };

    const profiles = get().profiles.map((item) => (item.id === profileId ? withdrawn : item));
    set({ profiles });
    persist(profiles);
    return { ok: true, profileId };
  },
}));
