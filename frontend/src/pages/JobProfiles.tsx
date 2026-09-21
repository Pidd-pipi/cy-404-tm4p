import { useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  Briefcase,
  ChevronDown,
  ChevronUp,
  CircleCheck,
  CircleX,
  Send,
  Undo2,
} from 'lucide-react';
import { Button } from '../components/common/Button';
import { EmptyState } from '../components/common/EmptyState';
import { isJobProfileExpired, JobProfileActionResult, useJobProfileStore } from '../stores/job-profile';
import { useResumeStore } from '../stores/resume';
import { JobProfile, jobProfileStatusLabels, JobProfileStatus } from '../types/job-profile';
import { Resume } from '../types/resume';
import { computeFitScore } from '../utils/fit-score';
import { formatDateTime } from '../utils/format';

const inputClass =
  'w-full rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--ink)] placeholder:text-[var(--muted)]';

const statusStyles: Record<JobProfileStatus, string> = {
  draft: 'bg-[var(--surface-alt)] text-[var(--muted)]',
  submitted: 'bg-[var(--accent-soft)] text-[var(--accent-strong)]',
  withdrawn: 'bg-[var(--surface-alt)] text-[var(--danger)]',
};

function parseSkillInput(value: string): string[] {
  const seen = new Set<string>();
  return value
    .split(/[\n,，、;；]/)
    .map((item) => item.trim())
    .filter((item) => {
      if (!item) {
        return false;
      }
      const key = item.toLowerCase();
      if (seen.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
    });
}

function scoreClass(score: number): string {
  if (score >= 80) {
    return 'text-[var(--accent-strong)]';
  }
  if (score >= 60) {
    return 'text-[var(--gold)]';
  }
  return 'text-[var(--clay)]';
}

function SkillChip({ name, matched }: { name: string; matched: boolean }) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium ${
        matched
          ? 'border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent-strong)]'
          : 'border-[var(--danger)] text-[var(--danger)]'
      }`}
    >
      {matched ? <CircleCheck size={12} aria-hidden /> : <CircleX size={12} aria-hidden />}
      {name}
    </span>
  );
}

interface JobProfileCardProps {
  profile: JobProfile;
  resume: Resume;
  onSubmit: (profileId: string) => JobProfileActionResult;
  onWithdraw: (profileId: string) => JobProfileActionResult;
}

function JobProfileCard({ profile, resume, onSubmit, onWithdraw }: JobProfileCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [actionError, setActionError] = useState('');

  // 已提交/已撤回的档案读取冻结快照，草稿跟随当前简历实时计算
  const source = profile.snapshot ?? resume;
  const breakdown = computeFitScore(source, profile.requiredSkills, profile.bonusSkills);
  const score = profile.fitScore ?? breakdown.score;
  const frozen = Boolean(profile.snapshot);
  const expired = isJobProfileExpired(profile.deadline);

  const submitBlockReason =
    profile.status !== 'draft'
      ? null
      : expired
        ? '已过截止日期，无法提交'
        : breakdown.missingRequiredSkills.length > 0
          ? `缺少必备技能：${breakdown.missingRequiredSkills.join('、')}`
          : null;
  const canWithdraw = profile.status !== 'withdrawn' && !expired;

  const handleSubmit = () => {
    const result = onSubmit(profile.id);
    setActionError(result.ok ? '' : result.reason);
  };

  const handleWithdraw = () => {
    const result = onWithdraw(profile.id);
    setActionError(result.ok ? '' : result.reason);
  };

  return (
    <article className="border border-[var(--border)] bg-[var(--surface)] p-5 shadow-panel">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-display text-xl font-semibold text-[var(--ink)]">{profile.jobTitle}</h3>
            <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${statusStyles[profile.status]}`}>
              {jobProfileStatusLabels[profile.status]}
            </span>
            {expired && profile.status !== 'withdrawn' ? (
              <span className="rounded-full bg-[var(--surface-alt)] px-2 py-0.5 text-xs font-semibold text-[var(--danger)]">
                已过期
              </span>
            ) : null}
          </div>
          <p className="mt-1 text-sm text-[var(--muted)]">
            {profile.company || '未填写公司'} · 截止 {profile.deadline} · 登记于 {formatDateTime(profile.createdAt)}
          </p>
          {profile.submittedAt ? (
            <p className="mt-1 text-xs text-[var(--muted)]">
              提交于 {formatDateTime(profile.submittedAt)} · 简历快照已冻结
            </p>
          ) : null}
          {profile.withdrawnAt ? (
            <p className="mt-1 text-xs text-[var(--muted)]">
              撤回于 {formatDateTime(profile.withdrawnAt)} · 历史保留，同岗位可重新登记
            </p>
          ) : null}
        </div>
        <div className="text-right">
          <p className={`font-display text-3xl font-semibold ${scoreClass(score)}`}>{score}</p>
          <p className="text-xs text-[var(--muted)]">适配分 / 100{frozen ? '（已冻结）' : '（实时）'}</p>
        </div>
      </div>

      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <div>
          <p className="text-xs font-semibold uppercase text-[var(--muted)]">必备技能</p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {profile.requiredSkills.length === 0 ? (
              <span className="text-xs text-[var(--muted)]">未设置</span>
            ) : (
              profile.requiredSkills.map((name) => (
                <SkillChip key={name} matched={breakdown.matchedRequiredSkills.includes(name)} name={name} />
              ))
            )}
          </div>
        </div>
        <div>
          <p className="text-xs font-semibold uppercase text-[var(--muted)]">加分技能</p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {profile.bonusSkills.length === 0 ? (
              <span className="text-xs text-[var(--muted)]">未设置</span>
            ) : (
              profile.bonusSkills.map((name) => (
                <SkillChip key={name} matched={breakdown.matchedBonusSkills.includes(name)} name={name} />
              ))
            )}
          </div>
        </div>
      </div>
      <p className="mt-3 text-xs text-[var(--muted)]">
        项目经历：共 {breakdown.projectCount} 个，计入评分 {breakdown.countedProjects} 个（最多 3 个，每个 5 分）
      </p>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        {profile.status === 'draft' ? (
          <Button
            disabled={Boolean(submitBlockReason)}
            icon={<Send size={15} aria-hidden />}
            onClick={handleSubmit}
            variant="primary"
          >
            提交档案
          </Button>
        ) : null}
        {canWithdraw ? (
          <Button icon={<Undo2 size={15} aria-hidden />} onClick={handleWithdraw}>
            撤回
          </Button>
        ) : null}
        <Button
          icon={expanded ? <ChevronUp size={15} aria-hidden /> : <ChevronDown size={15} aria-hidden />}
          onClick={() => setExpanded((value) => !value)}
          variant="ghost"
        >
          {expanded ? '收起详情' : '查看详情'}
        </Button>
      </div>
      {submitBlockReason ? <p className="mt-2 text-xs text-[var(--danger)]">{submitBlockReason}</p> : null}
      {actionError ? <p className="mt-2 text-xs text-[var(--danger)]">{actionError}</p> : null}

      {expanded ? (
        <div className="mt-4 space-y-3 border-t border-[var(--border)] pt-4 text-sm leading-6">
          <p className="font-semibold text-[var(--ink)]">评分构成</p>
          <ul className="list-disc space-y-1 pl-5 text-[var(--muted)]">
            <li>
              必备技能命中 {breakdown.matchedRequiredSkills.length} / {profile.requiredSkills.length}
              {breakdown.missingRequiredSkills.length > 0
                ? `，缺失：${breakdown.missingRequiredSkills.join('、')}`
                : ''}
            </li>
            <li>
              加分技能命中 {breakdown.matchedBonusSkills.length} / {profile.bonusSkills.length}
              {breakdown.missingBonusSkills.length > 0 ? `，未命中：${breakdown.missingBonusSkills.join('、')}` : ''}
            </li>
            <li>项目经历计入 {breakdown.countedProjects} 个</li>
          </ul>
          {frozen && profile.snapshot ? (
            <p className="text-xs text-[var(--muted)]">
              快照：「{profile.snapshot.title}」（简历更新于 {formatDateTime(profile.snapshot.updatedAt)}
              ），冻结于 {profile.submittedAt ? formatDateTime(profile.submittedAt) : '-'}
              。后续对简历的编辑不会改写本档案，如需使用最新简历请撤回后重新登记。
            </p>
          ) : (
            <p className="text-xs text-[var(--muted)]">草稿状态的适配分随简历实时更新，提交后将冻结简历快照。</p>
          )}
          {profile.status === 'withdrawn' ? (
            <p className="text-xs text-[var(--muted)]">该档案已撤回，仅作为历史记录保留，不再参与岗位去重。</p>
          ) : null}
        </div>
      ) : null}
    </article>
  );
}

export function JobProfiles() {
  const { id } = useParams();
  const resumes = useResumeStore((state) => state.resumes);
  const profiles = useJobProfileStore((state) => state.profiles);
  const registerProfile = useJobProfileStore((state) => state.registerProfile);
  const submitProfile = useJobProfileStore((state) => state.submitProfile);
  const withdrawProfile = useJobProfileStore((state) => state.withdrawProfile);

  const [jobTitle, setJobTitle] = useState('');
  const [company, setCompany] = useState('');
  const [deadline, setDeadline] = useState('');
  const [requiredText, setRequiredText] = useState('');
  const [bonusText, setBonusText] = useState('');
  const [formError, setFormError] = useState('');

  const resume = resumes.find((item) => item.id === id);
  const resumeProfiles = useMemo(
    () =>
      profiles
        .filter((profile) => profile.resumeId === id)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    [profiles, id],
  );

  if (!resume) {
    return (
      <EmptyState
        actionLabel="回到列表"
        description="该简历可能已经被删除，返回列表后可以创建或导入新的版本。"
        icon={<Briefcase size={24} aria-hidden />}
        onAction={() => window.history.back()}
        title="没有找到这份简历"
      />
    );
  }

  const handleRegister = () => {
    const result = registerProfile({
      resumeId: resume.id,
      jobTitle,
      company,
      deadline,
      requiredSkills: parseSkillInput(requiredText),
      bonusSkills: parseSkillInput(bonusText),
    });
    if (!result.ok) {
      setFormError(result.reason);
      return;
    }
    setFormError('');
    setJobTitle('');
    setCompany('');
    setDeadline('');
    setRequiredText('');
    setBonusText('');
  };

  const statusCount = (status: JobProfileStatus) =>
    resumeProfiles.filter((profile) => profile.status === status).length;

  return (
    <div>
      <div className="flex flex-col justify-between gap-4 border-b border-[var(--border)] pb-6 md:flex-row md:items-end">
        <div>
          <p className="text-sm font-semibold uppercase text-[var(--accent-strong)]">Job fit profiles</p>
          <h1 className="mt-2 font-display text-4xl font-semibold">岗位适配档案</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--muted)]">
            为「{resume.title}」登记目标岗位，系统按技能等级与项目计算适配分；提交时冻结简历快照，截止前可撤回。
          </p>
        </div>
        <Link
          className="inline-flex min-h-10 items-center gap-2 rounded-md border border-[var(--border)] px-4 py-2 text-sm font-semibold hover:bg-[var(--surface-alt)]"
          to="/resumes"
        >
          <ArrowLeft size={16} aria-hidden /> 返回列表
        </Link>
      </div>

      <section className="mt-6 border border-[var(--border)] bg-[var(--surface)] p-5">
        <h2 className="font-display text-2xl font-semibold">登记岗位</h2>
        <p className="mt-1 text-xs text-[var(--muted)]">
          当前简历技能：{resume.skills.map((skill) => skill.name).join('、') || '暂无'}。同一岗位在未撤回前只能登记一次。
        </p>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <label className="space-y-1 text-sm font-medium">
            <span>岗位名称 *</span>
            <input
              className={inputClass}
              placeholder="例如：高级产品经理"
              value={jobTitle}
              onChange={(event) => setJobTitle(event.target.value)}
            />
          </label>
          <label className="space-y-1 text-sm font-medium">
            <span>公司（选填）</span>
            <input
              className={inputClass}
              placeholder="例如：青松科技"
              value={company}
              onChange={(event) => setCompany(event.target.value)}
            />
          </label>
          <label className="space-y-1 text-sm font-medium">
            <span>截止日期 *</span>
            <input
              className={inputClass}
              type="date"
              value={deadline}
              onChange={(event) => setDeadline(event.target.value)}
            />
          </label>
          <label className="space-y-1 text-sm font-medium">
            <span>必备技能（逗号或换行分隔）</span>
            <textarea
              className={`${inputClass} min-h-20 resize-y`}
              placeholder="例如：SQL / 数据分析, A/B Testing"
              value={requiredText}
              onChange={(event) => setRequiredText(event.target.value)}
            />
          </label>
          <label className="space-y-1 text-sm font-medium">
            <span>加分技能（逗号或换行分隔）</span>
            <textarea
              className={`${inputClass} min-h-20 resize-y`}
              placeholder="例如：英语沟通"
              value={bonusText}
              onChange={(event) => setBonusText(event.target.value)}
            />
          </label>
        </div>
        {formError ? <p className="mt-3 text-sm text-[var(--danger)]">{formError}</p> : null}
        <Button className="mt-4" icon={<Briefcase size={16} aria-hidden />} onClick={handleRegister} variant="primary">
          登记岗位
        </Button>
      </section>

      <section className="mt-8">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="font-display text-2xl font-semibold">已登记档案</h2>
          <p className="text-xs text-[var(--muted)]">
            共 {resumeProfiles.length} 份 · 草稿 {statusCount('draft')} · 已提交 {statusCount('submitted')} · 已撤回{' '}
            {statusCount('withdrawn')}
          </p>
        </div>
        {resumeProfiles.length === 0 ? (
          <div className="mt-4">
            <EmptyState
              description="登记目标岗位后，可以在这里提交、撤回并回查适配分与冻结快照。"
              icon={<Briefcase size={24} aria-hidden />}
              title="还没有岗位档案"
            />
          </div>
        ) : (
          <div className="mt-4 space-y-4">
            {resumeProfiles.map((profile) => (
              <JobProfileCard
                key={profile.id}
                profile={profile}
                resume={resume}
                onSubmit={submitProfile}
                onWithdraw={withdrawProfile}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
