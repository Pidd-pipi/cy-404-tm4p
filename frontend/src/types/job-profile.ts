import { Resume } from './resume';

export type JobProfileStatus = 'draft' | 'submitted' | 'withdrawn';

export interface JobProfile {
  id: string;
  resumeId: string;
  jobTitle: string;
  company: string;
  deadline: string;
  requiredSkills: string[];
  bonusSkills: string[];
  status: JobProfileStatus;
  /** 提交时冻结的适配分；草稿状态下为 null，页面实时计算 */
  fitScore: number | null;
  /** 提交时冻结的缺失必备技能列表 */
  missingRequiredSkills: string[];
  /** 提交时冻结的简历快照，后续编辑简历不影响已提交档案 */
  snapshot: Resume | null;
  createdAt: string;
  submittedAt: string | null;
  withdrawnAt: string | null;
}

export const jobProfileStatusLabels: Record<JobProfileStatus, string> = {
  draft: '草稿',
  submitted: '已提交',
  withdrawn: '已撤回',
};
