import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useHeardPath } from "@/components/heard/HeardBase";
import HeardPage from "@/components/heard/v2/HeardLayout";
import { HeardButton } from "@/components/heard/v2/HeardKit";

const OPTIONS = [
  { value: "peer_listener", label: "Peer Listener", text: "Listen to people who call Heard." },
  { value: "social_media_volunteer", label: "Social Media Volunteer", text: "Help us find us and build the community around Heard." },
  { value: "professional", label: "Counsellor, psychologist or clinician", text: "Listen, supervise, support or help with referrals." },
] as const;

export const HeardRoleChoice = () => {
  const heardPath = useHeardPath();
  const navigate = useNavigate();
  const [role, setRole] = useState("");
  return (
    <HeardPage path="/get-involved/choose-role" title="Choose a role — Heard" description="Choose how you would like to be part of Heard.">
      <form className="flex flex-col gap-8" onSubmit={(event) => { event.preventDefault(); if (role) navigate(`${heardPath("/volunteer/create-account")}?role=${role}`); }}>
        <header className="flex flex-col gap-4">
          <span className="hv-index">Choose a role</span>
          <h1>Which role are you drawn to?</h1>
        </header>
        <fieldset className="grid gap-px border border-[color:var(--hv-late)] bg-[color:var(--hv-late)]">
          <legend className="sr-only">Volunteer role</legend>
          {OPTIONS.map((option) => (
            <label key={option.value} className="hv-role-option" data-selected={role === option.value}>
              <input className="sr-only" type="radio" name="role" value={option.value} checked={role === option.value} onChange={() => setRole(option.value)} />
              <span className="hv-role-dot" aria-hidden="true" />
              <span><strong>{option.label}</strong><small>{option.text}</small></span>
            </label>
          ))}
        </fieldset>
        <div><HeardButton type="submit" disabled={!role}>Continue</HeardButton></div>
      </form>
    </HeardPage>
  );
};

export default HeardRoleChoice;