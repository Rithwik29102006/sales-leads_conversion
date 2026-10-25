// Analytics - numbers from the Analytics Agent, drawn as simple bar charts, plus model retraining.

import { useEffect, useState } from "react";
import { api } from "../api";

// One horizontal bar chart: rows of [label, value]
function Bars({ title, rows, colour = "bg-navy", suffix = "" }) {
  const max = Math.max(1, ...rows.map(([, v]) => v));
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <h3 className="mb-4 font-bold text-navy">{title}</h3>
      <div className="space-y-3">
        {rows.map(([label, value]) => (
          <div key={label} className="grid grid-cols-[8rem_1fr_3rem] items-center gap-3 text-sm">
            <span className="truncate">{label}</span>
            <div className="h-4 rounded bg-slate-100">
              <div className={`h-4 rounded ${colour}`} style={{ width: `${(value / max) * 100}%` }} />
            </div>
            <span className="text-right font-semibold tabular-nums">{value}{suffix}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function Analytics() {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [training, setTraining] = useState(false);
  const [trainResult, setTrainResult] = useState(null);
  const [learning, setLearning] = useState(null);

  const loadLearning = () => api.getLearning().then(setLearning).catch(() => {});
  useEffect(() => {
    api.getAnalytics().then(setData).catch((err) => setError(err.message));
    loadLearning();
  }, []);

  async function rescore() {
    setTraining(true);
    setTrainResult(null);
    try {
      const result = await api.rescore();               // POST /rescore
      setTrainResult({ ok: true, text: `Re-scored ${result.rescored} leads with the current model.` });
      setData(await api.getAnalytics());
      loadLearning();
    } catch (err) {
      setTrainResult({ ok: false, text: err.message });
    } finally {
      setTraining(false);
    }
  }

  async function retrain() {
    setTraining(true);
    setTrainResult(null);
    try {
      const result = await api.retrain();               // POST /retrain
      const messageModel = (result.message_model || []).filter(Boolean).join(" ");
      setTrainResult({ ok: true, text: `Used ${result.outcomes_used} outcomes. ${result.training_output.filter(Boolean).join(" ")} Message model: ${messageModel} Re-scored ${result.rescored} leads.` });
      setData(await api.getAnalytics());
      loadLearning();
    } catch (err) {
      setTrainResult({ ok: false, text: err.message });
    } finally {
      setTraining(false);
    }
  }

  if (error) return <p className="rounded-md bg-red-50 px-4 py-3 text-red-700">{error}</p>;
  if (!data) return <p>Loading...</p>;

  const channels = Object.entries(data.by_channel).sort((a, b) => b[1].leads - a[1].leads);
  // Conversion rate = converted / finished leads (open leads are not counted yet)
  const rateByChannel = channels
    .filter(([, v]) => v.closed > 0)
    .map(([c, v]) => [c, Math.round((v.converted / v.closed) * 100)]);

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-bold text-navy">Analytics</h2>
      <div className="grid gap-6 lg:grid-cols-2">
        <Bars title="Leads by channel" rows={channels.map(([c, v]) => [c, v.leads])} />
        <Bars title="Conversion rate by channel (finished leads)" rows={rateByChannel} colour="bg-brand-green" suffix="%" />
        <Bars title="Leads by priority" rows={Object.entries(data.by_priority)} colour="bg-brand-orange" />
        <Bars title="Leads by status" rows={Object.entries(data.by_status)} />
      </div>

      <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
        <h3 className="font-bold text-navy">Model</h3>
        {learning && (
          <div className="mt-2 rounded-md bg-navy-light px-3 py-2 text-sm">
            <b>Learning automatically.</b> {learning.finished_leads} finished leads (Converted / Not Converted);{" "}
            {learning.used_in_last_training > 0 ? `the last training used ${learning.used_in_last_training}. ` : "no training on your data yet. "}
            Next automatic training at <b>{learning.next_training_at}</b> finished leads.{" "}
            {learning.message_model
              ? `Message model: learned from ${learning.message_model.chats} of your chats (AUC ${learning.message_model.auc}).`
              : "Message model: waiting for 15 converted and 15 not-converted chats."}
          </div>
        )}
        <p className="mt-2 text-sm text-slate-500">
          <b>Retrain</b> uses leads marked Converted / Not Converted (at least 10); the new model is kept only if it
          scores better on the test set. <b>Re-score</b> updates every saved lead with the current model and rules.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <button onClick={retrain} disabled={training}
            className="rounded-md bg-navy px-4 py-2 text-sm font-semibold text-white disabled:opacity-60">
            {training ? "Working..." : "Retrain now"}
          </button>
          <button onClick={rescore} disabled={training}
            className="rounded-md border border-slate-300 px-4 py-2 text-sm font-semibold hover:bg-slate-100 disabled:opacity-60">
            Re-score all leads
          </button>
        </div>
        {trainResult && (
          <p className={`mt-3 rounded-md px-3 py-2 text-sm ${trainResult.ok ? "bg-green-50 text-green-800" : "bg-red-50 text-red-700"}`}>
            {trainResult.text}
          </p>
        )}
      </div>
    </div>
  );
}
