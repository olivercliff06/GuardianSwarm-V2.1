import type { ReactNode } from 'react';
import type { Assessment, InvestigationReport, InvestigationState, Risk } from '../types';
import { Activity, CheckCircle2, CircleDashed, ExternalLink, ShieldAlert, Sparkles, TriangleAlert } from 'lucide-react';

export const riskClass = (risk?: Risk) => risk === 'HIGH' ? 'risk high' : risk === 'MEDIUM' ? 'risk medium' : risk === 'LOW' ? 'risk low' : 'risk unknown';
export function Card({ children, className = '' }: { children: ReactNode; className?: string }) { return <section className={`card ${className}`}>{children}</section>; }
export function GuardianHeader({ online }: { online: boolean }) { return <header className="hero"><div className="brand"><div className="logo"><ShieldAlert size={20}/></div><div><h1>Guardian Swarm</h1><p>Autonomous liquidity investigation</p></div></div><span className={online ? 'status online' : 'status offline'}>{online ? 'Backend online' : 'Backend offline'}</span></header>; }
export function RiskBadge({ risk }: { risk?: Risk }) { return <span className={riskClass(risk)}>{risk?.replace('_', ' ') || 'PENDING'}</span>; }
export function AgentCard({ title, assessment, active }: { title: string; assessment?: Assessment; active?: boolean }) { return <div className={`agent ${active ? 'active' : ''}`}><div className="agent-head"><div>{active ? <CircleDashed className="spin" size={16}/> : assessment ? <CheckCircle2 size={16}/> : <Activity size={16}/>}<strong>{title}</strong></div><RiskBadge risk={assessment?.verdict}/></div>{assessment && <><p>{assessment.reasoning}</p><div className="agent-meta"><span>{assessment.runtime}</span><span>{assessment.latencyMs} ms</span><span>{Math.round(assessment.confidence * 100)}% est.</span></div></>}</div>; }
export function Timeline({ state }: { state?: InvestigationState }) {
  const steps = ['liquidity','baseline','security','verification','arbitration','completed']; const at = state ? steps.indexOf(state.status) : -1;
  return <Card><div className="section-title"><Activity size={16}/><h2>Investigation timeline</h2></div><div className="progress"><i style={{width:`${state?.progress ?? 0}%`}}/></div><p className="muted">{state?.message ?? 'Ready to investigate'}</p><div className="timeline">{steps.map((s,i)=><div key={s} className={i <= at ? 'done' : ''}><span>{i < at ? '✓' : i + 1}</span>{s}</div>)}</div></Card>;
}
export function Evidence({ report }: { report: InvestigationReport }) {
  const unique = [...report.security.evidence];
  return <Card><div className="section-title"><CheckCircle2 size={16}/><h2>Evidence provenance</h2></div>{unique.map(e=><div className="evidence" key={e.id}><span className={`verify ${e.verificationStatus.toLowerCase()}`}>{e.verificationStatus}</span><div><strong>{e.source}</strong><p>{e.summary}</p>{e.url && <a href={e.url} target="_blank">Open source <ExternalLink size={12}/></a>}</div></div>)}</Card>;
}
export function Comparison({ report }: { report: InvestigationReport }) { return <Card className="comparison"><div className="section-title"><Sparkles size={16}/><h2>Baseline vs Swarm</h2></div><div className="compare-grid"><div><small>SINGLE AGENT</small><RiskBadge risk={report.baseline.verdict}/><p>{report.baseline.reasoning}</p></div><div><small>GUARDIAN SWARM</small><RiskBadge risk={report.finalRisk}/><p>{report.arbitration?.reasoning || report.security.reasoning}</p></div></div>{report.baseline.verdict !== report.finalRisk && <div className="value"><TriangleAlert size={16}/><span>The swarm changed the conclusion after independent challenge and evidence arbitration.</span></div>}</Card>; }
