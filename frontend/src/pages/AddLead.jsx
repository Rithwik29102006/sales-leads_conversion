// Add Lead page - the form, then the model's result for the new lead.

import { useState } from "react";
import { api } from "../api";
import LeadForm from "../components/LeadForm";
import { PriorityBadge, ScoreBar, ScoreBreakdown, IntentTags } from "../components/Badges";

export default function AddLead({ options, onOpenLead }) {
  const [result, setResult] = useState(null);
  const [formKey, setFormKey] = useState(0);   // changing the key clears the form

  async function save(payload) {
    const lead = await api.addLead(payload);   // POST /leads -> analysed, scored, saved
    setResult(lead);
    setFormKey(formKey + 1);
  }

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm lg:col-span-2">
        <h2 className="mb-4 text-xl font-bold text-navy">Add a new lead</h2>
        <LeadForm key={formKey} options={options} submitLabel="Save and score lead" onSubmit={save} />
      </div>

      <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="mb-4 text-xl font-bold text-navy">Model result</h2>
        {!result ? (
          <p className="text-sm text-slate-500">Fill in the form and save. The model will score the lead here.</p>
        ) : (
          <div className="space-y-4">
            <p className="text-lg font-semibold">{result.name}</p>
            <div className="flex items-center gap-3"><ScoreBar score={result.score} priority={result.priority} /><PriorityBadge priority={result.priority} /></div>
            <ScoreBreakdown lead={result} />
            <IntentTags tags={result.intent_tags} />
            <div>
              <p className="text-sm font-semibold text-slate-600">Why</p>
              <p className="text-sm">{result.reasons}</p>
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-600">Suggested message</p>
              <p className="rounded-md bg-navy-light p-3 text-sm">{result.draft_message}</p>
            </div>
            {result.needs_follow_up && (
              <p className="rounded-md bg-amber-50 p-2 text-sm text-amber-800">High priority: contact this lead today.</p>
            )}
            <button onClick={() => onOpenLead(result.id)} className="text-sm font-semibold text-navy underline">
              Open lead details
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
