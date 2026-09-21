import { FormEvent, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  Briefcase,
  CalendarClock,
  ChevronDown,
  ChevronUp,
  Lock,
  Send,
  Undo2,
} from 'lucide-react';
import { Button } from '../components/common/Button';
import { EmptyState } from '../components/common/EmptyState';
import { useJobFitStore } from '../stores/job-fit';
import { useResumeStore } from '../stores/resume';
import { skillLevelLabels } from '../types/enums';
import { JobFitProfile, jobFitStatusLabels } from '../types/job-fit';
import { Resume } from '../types/resume';
import { computeFitScore, isDeadlinePassed, parseSkillInput } from '../utils/job-fit';
import { formatDateTime } from '../utils/format';

const inputClass =
  'w-full rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--ink)] placeholder:text-[var(--muted)]';

const statusBadgeClass: Record<JobFitProfile['status'], string> = {
  draft: 'border border-[var(--border)] text-[var(--muted)]',
  submitted: 'bg-[var(--accent-soft)] text-[var(--accent-strong)]',
  withdrawn: 'bg-[var(--surface-alt)] text-[var(--muted)]',
};

function SkillChips({ label, skills, tone }: { label: string; skills: string[]; tone: 'ok' | 'miss' | 'plain' }) {
  if (skills.length === 0) {
    return null;
  }
  const toneClass =
    tone === 'ok'
      ? 'border-[var(--accent)] text-[var(--accent-strong)]'
      : tone === 'miss'
        ? 'border-[var(--danger)] text-[var(--danger)]'
        : 'border-[var(--border)] text-[var(--muted)]';
  return (
    <div className="flex flex-wrap items-center gap-2 text-xs">
      <span className="font-semibold text-[var(--muted)]">{label}</span>
      {skills.map((skill) => (
        <span className={`rounded-full border px-2 py-0.5 ${toneClass}`} key={skill}>
          {skill}
        </span>
      ))}
    </div>
  );
}

function JobFitProfileCard({ profile, resume }: { profile: JobFitProfile; resume: Resume }) {
  const submitProfile = useJobFitStore((state) => state.submitProfile);
  const withdrawProfile = useJobFitStore((state) => state.withdrawProfile);
  const [expanded, setExpanded] = useState(false);
  const [message, setMessage] = useState('');

  const expired = isDeadlinePassed(profile.deadline);
  const liveBreakdown = useMemo(
    () => (profile.status === 'draft' ? computeFitScore(resume, profile.requiredSkills, profile.bonusSkills) : null),
    [profile, resume],
  );
  const score = liveBreakdown?.score ?? profile.fitScore;
  const matchedRequired = liveBreakdown?.matchedRequired ?? profile.matchedRequired;
  const missingRequired = liveBreakdown?.missingRequired ?? profile.missingRequired;
  const matchedBonus = liveBreakdown?.matchedBonus ?? profile.matchedBonus;
  const matchedProjects = liveBreakdown?.matchedProjects ?? profile.matchedProjects;

  const submitBlockReason =
    profile.status !== 'draft'
      ? null
      : expired
        ? '已过截止日期，不能提交'
        : missingRequired.length > 0
          ? `缺少必备技能：${missingRequired.join('、')}`
          : null;

  const handleSubmit = () => {
    const result = submitProfile(profile.id);
    setMessage(result.ok ? '' : result.reason);
  };

  const handleWithdraw = () => {
    const result = withdrawProfile(profile.id);
    setMessage(result.ok ? '' : result.reason);
  };

  return (
    <article className="border border-[var(--border)] bg-[var(--surface)] p-5 shadow-panel">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-display text-xl font-semibold text-[var(--ink)]">{profile.position}</h3>
            <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${statusBadgeClass[profile.status]}`}>
              {jobFitStatusLabels[profile.status]}
            </span>
            {expired && profile.status !== 'withdrawn' ? (
              <span className="rounded-full border border-[var(--danger)] px-2 py-0.5 text-xs font-semibold text-[var(--danger)]">
                已过期
              </span>
            ) : null}
          </div>
          <p className="mt-1 flex items-center gap-1 text-xs text-[var(--muted)]">
            <CalendarClock size={13} aria-hidden /> 截止 {profile.deadline} · 登记于 {formatDateTime(profile.createdAt)}
            {profile.submittedAt ? ` · 提交于 ${formatDateTime(profile.submittedAt)}` : ''}
            {profile.withdrawnAt ? ` · 撤回于 ${formatDateTime(profile.withdrawnAt)}` : ''}
          </p>
        </div>
        <div className="text-right">
          <p className="font-display text-3xl font-semibold text-[var(--accent-strong)]">{score}</p>
          <p className="text-xs text-[var(--muted)]">适配分 / 100{profile.status === 'draft' ? '（实时）' : '（已冻结）'}</p>
        </div>
      </div>

      <div className="mt-4 space-y-2">
        <SkillChips label="必备命中" skills={matchedRequired} tone="ok" />
        <SkillChips label="必备缺失" skills={missingRequired} tone="miss" />
        <SkillChips label="加分命中" skills={matchedBonus} tone="plain" />
        <SkillChips label="命中项目" skills={matchedProjects} tone="plain" />
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        {profile.status === 'draft' ? (
          <Button
            disabled={Boolean(submitBlockReason)}
            icon={<Send size={15} aria-hidden />}
            onClick={handleSubmit}
            variant="primary"
          >
            提交
          </Button>
        ) : null}
        {profile.status !== 'withdrawn' ? (
          <Button disabled={expired} icon={<Undo2 size={15} aria-hidden />} onClick={handleWithdraw}>
            撤回
          </Button>
        ) : null}
        {profile.snapshot ? (
          <Button
            icon={expanded ? <ChevronUp size={15} aria-hidden /> : <ChevronDown size={15} aria-hidden />}
            onClick={() => setExpanded((value) => !value)}
            variant="ghost"
          >
            快照回查
          </Button>
        ) : (
          <span className="text-xs text-[var(--muted)]">提交后冻结简历快照</span>
        )}
      </div>
      {submitBlockReason ? <p className="mt-2 text-xs text-[var(--danger)]">{submitBlockReason}</p> : null}
      {message ? <p className="mt-2 text-xs text-[var(--danger)]">{message}</p> : null}
      {profile.status === 'withdrawn' ? (
        <p className="mt-2 text-xs text-[var(--muted)]">档案已撤回，历史保留；该岗位可重新登记。</p>
      ) : null}

      {expanded && profile.snapshot ? (
        <div className="mt-4 space-y-3 border-t border-[var(--border)] pt-4 text-sm">
          <p className="flex items-center gap-1 text-xs font-semibold text-[var(--muted)]">
            <Lock size={13} aria-hidden />
            快照冻结于 {formatDateTime(profile.submittedAt ?? profile.updatedAt)} · 简历「{profile.snapshot.title}」
          </p>
          <div className="flex flex-wrap gap-2">
            {profile.snapshot.skills.map((skill) => (
              <span
                className="rounded-full border border-[var(--border)] px-2 py-0.5 text-xs text-[var(--ink)]"
                key={skill.id}
              >
                {skill.name} · {skillLevelLabels[skill.level]}
              </span>
            ))}
          </div>
          <ul className="space-y-1 text-xs text-[var(--muted)]">
            {profile.snapshot.projects.map((project) => (
              <li key={project.id}>
                {project.name}（{project.techStack.join(' / ') || '未填写技术栈'}）
              </li>
            ))}
          </ul>
          <p className="text-xs text-[var(--muted)]">快照已冻结，后续编辑简历不会改写本档案；如需更新，请在截止前撤回后重新登记。</p>
        </div>
      ) : null}
    </article>
  );
}

export function JobFitProfiles() {
  const { id } = useParams<{ id: string }>();
  const resume = useResumeStore((state) => state.resumes.find((item) => item.id === id));
  const profiles = useJobFitStore((state) => state.profiles);
  const registerProfile = useJobFitStore((state) => state.registerProfile);

  const [position, setPosition] = useState('');
  const [deadline, setDeadline] = useState('');
  const [requiredText, setRequiredText] = useState('');
  const [bonusText, setBonusText] = useState('');
  const [formError, setFormError] = useState('');

  const preview = useMemo(
    () => (resume ? computeFitScore(resume, parseSkillInput(requiredText), parseSkillInput(bonusText)) : null),
    [resume, requiredText, bonusText],
  );

  if (!resume) {
    return (
      <EmptyState
        actionLabel="返回简历列表"
        description="没有找到对应的简历，可能已被删除。"
        icon={<Briefcase size={24} aria-hidden />}
        onAction={() => window.history.back()}
        title="简历不存在"
      />
    );
  }

  const resumeProfiles = profiles.filter((profile) => profile.resumeId === resume.id);

  const handleRegister = (event: FormEvent) => {
    event.preventDefault();
    const result = registerProfile({
      resumeId: resume.id,
      position,
      deadline,
      requiredSkills: parseSkillInput(requiredText),
      bonusSkills: parseSkillInput(bonusText),
    });
    if (!result.ok) {
      setFormError(result.reason);
      return;
    }
    setFormError('');
    setPosition('');
    setDeadline('');
    setRequiredText('');
    setBonusText('');
  };

  return (
    <div>
      <div className="border-b border-[var(--border)] pb-6">
        <Link className="inline-flex items-center gap-1 text-sm text-[var(--muted)] hover:text-[var(--ink)]" to="/resumes">
          <ArrowLeft size={15} aria-hidden /> 返回简历列表
        </Link>
        <p className="mt-3 text-sm font-semibold uppercase text-[var(--accent-strong)]">Job fit profiles</p>
        <h1 className="mt-2 font-display text-4xl font-semibold">岗位适配档案</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--muted)]">
          为「{resume.title}」登记目标岗位，按技能等级与项目计算适配分；提交时冻结简历快照，截止前可撤回并重新登记。
        </p>
      </div>

      <section className="mt-6 border border-[var(--border)] bg-[var(--surface)] p-5">
        <h2 className="font-display text-2xl font-semibold">登记岗位</h2>
        <form className="mt-4 grid gap-4 md:grid-cols-2" onSubmit={handleRegister}>
          <label className="space-y-1 text-sm font-medium">
            <span>岗位名称</span>
            <input
              className={inputClass}
              onChange={(event) => setPosition(event.target.value)}
              placeholder="例如：高级产品经理"
              value={position}
            />
          </label>
          <label className="space-y-1 text-sm font-medium">
            <span>截止日期</span>
            <input className={inputClass} onChange={(event) => setDeadline(event.target.value)} type="date" value={deadline} />
          </label>
          <label className="space-y-1 text-sm font-medium">
            <span>必备技能（逗号或换行分隔）</span>
            <textarea
              className={`${inputClass} min-h-24 resize-y`}
              onChange={(event) => setRequiredText(event.target.value)}
              placeholder={'SQL / 数据分析\nA/B Testing'}
              value={requiredText}
            />
          </label>
          <label className="space-y-1 text-sm font-medium">
            <span>加分技能（逗号或换行分隔）</span>
            <textarea
              className={`${inputClass} min-h-24 resize-y`}
              onChange={(event) => setBonusText(event.target.value)}
              placeholder={'英语沟通, 增长实验'}
              value={bonusText}
            />
          </label>
          {preview ? (
            <div className="rounded-md border border-dashed border-[var(--border)] p-3 text-xs leading-6 text-[var(--muted)] md:col-span-2">
              当前适配分预览：<span className="font-semibold text-[var(--accent-strong)]">{preview.score} / 100</span>
              {preview.missingRequired.length > 0 ? ` · 缺少必备技能：${preview.missingRequired.join('、')}` : ' · 必备技能齐全'}
              {deadline && isDeadlinePassed(deadline) ? ' · 该截止日期已过，登记后将无法提交' : ''}
            </div>
          ) : null}
          {formError ? <p className="text-sm text-[var(--danger)] md:col-span-2">{formError}</p> : null}
          <div className="md:col-span-2">
            <Button icon={<Briefcase size={15} aria-hidden />} type="submit" variant="primary">
              登记档案
            </Button>
          </div>
        </form>
      </section>

      <section className="mt-8">
        <h2 className="font-display text-2xl font-semibold">档案记录</h2>
        {resumeProfiles.length === 0 ? (
          <div className="mt-4">
            <EmptyState
              description="登记岗位后，可在此提交、撤回并回查冻结的简历快照。"
              icon={<Briefcase size={24} aria-hidden />}
              title="还没有岗位档案"
            />
          </div>
        ) : (
          <div className="mt-4 grid gap-4">
            {resumeProfiles.map((profile) => (
              <JobFitProfileCard key={profile.id} profile={profile} resume={resume} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
