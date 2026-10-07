import { useQuery } from '@tanstack/react-query'
import { CalendarClock, FileCode2, Play, Timer } from 'lucide-react'
import { useState } from 'react'
import { cronPolicyApi, policyScriptApi } from '../api/rule'
import { Card } from '../components/ui/Card'
import { PageHeader } from '../components/ui/PageHeader'
import { StatCard } from '../components/ui/StatCard'
import { Tabs } from '../components/ui/Tabs'
import { CronTab } from '../features/rules/CronTab'
import { ScriptsTab } from '../features/rules/ScriptsTab'

type Tab = 'cron' | 'scripts'

export default function RulesPage() {
  const [tab, setTab] = useState<Tab>('cron')
  const scripts = useQuery({ queryKey: ['policyScripts'], queryFn: policyScriptApi.getAll })
  const policies = useQuery({ queryKey: ['cronPolicies', 'all'], queryFn: cronPolicyApi.getAll })
  const activeJobs = useQuery({ queryKey: ['cronPolicies', 'active'], queryFn: cronPolicyApi.getActive })

  const all = policies.data ?? []

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Rule API"
        title="Kurallar & Otomasyon"
        description="Rule Engine’de çalışan politika scriptleri ve bunları zamanlayan cron politikaları."
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard icon={<FileCode2 className="size-4" />} label="Politika scripti" value={scripts.data?.length ?? 0} loading={scripts.isLoading} accent="sky" />
        <StatCard icon={<CalendarClock className="size-4" />} label="Cron politikası" value={all.length} loading={policies.isLoading} accent="violet" />
        <StatCard icon={<Play className="size-4" />} label="Aktif iş" value={activeJobs.data?.length ?? 0} loading={activeJobs.isLoading} accent="emerald" sub="Rule Engine’de çalışıyor" />
        <StatCard icon={<Timer className="size-4" />} label="Tek seferlik" value={all.filter((p) => p.forOnce).length} loading={policies.isLoading} accent="amber" />
      </div>

      <Card>
        <Tabs
          className="mx-5 mb-4 pt-2"
          value={tab}
          onChange={setTab}
          items={[
            { value: 'cron', label: 'Cron politikaları', icon: <CalendarClock className="size-4" />, count: all.length },
            { value: 'scripts', label: 'Politika scriptleri', icon: <FileCode2 className="size-4" />, count: scripts.data?.length },
          ]}
        />
        {tab === 'cron' ? (
          <CronTab
            policies={all}
            scripts={scripts.data ?? []}
            loading={policies.isLoading}
            error={policies.error}
            onRetry={() => policies.refetch()}
          />
        ) : (
          <ScriptsTab
            scripts={scripts.data ?? []}
            cronPolicies={all}
            loading={scripts.isLoading}
            error={scripts.error}
            onRetry={() => scripts.refetch()}
          />
        )}
      </Card>
    </div>
  )
}
