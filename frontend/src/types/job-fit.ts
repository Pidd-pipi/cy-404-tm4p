import { Resume } from './resume';

export type JobFitStatus = 'draft' | 'submitted' | 'withdrawn';

export interface JobFitProfile {
  id: string;
  resumeId: string;
  position: string;
  deadline: string;
  requiredSkills: string[];
  bonusSkills: string[];
  status: JobFitStatus;
  fitScore: number;
  matchedRequired: string[];
  missingRequired: string[];
  matchedBonus: string[];
  matchedProjects: string[];
  snapshot: Resume | null;
  createdAt: string;
  updatedAt: string;
  submittedAt: string | null;
  withdrawnAt: string | null;
}

export const jobFitStatusLabels: Record<JobFitStatus, string> = {
  draft: '草稿',
  submitted: '已提交',
  withdrawn: '已撤回',
};
