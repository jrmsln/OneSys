import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "../lib/supabase";

interface Service {
  id: string;
  title: string;
  service_date: string;
  start_time: string;
  status: "draft" | "published" | "completed";
  notes: string | null;
  playlist_url: string | null;
  archived_at?: string | null;
}
interface Member {
  id: string;
  full_name: string;
}
interface Role {
  id: string;
  name: string;
}
interface Assignment {
  id: string;
  user_id: string;
  role_id: string;
  status: string;
  memberName: string;
  roleName: string;
}
interface SetlistSong {
  id: string;
  song_id: string;
  position: number;
  title: string;
  artist: string | null;
}

type WorkflowStep = "details" | "lineup" | "setlist";

export function ServicesView({
  session,
  onBack,
}: {
  session: Session;
  onBack: () => void;
}) {
  const [services, setServices] = useState<Service[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [setlistSongs, setSetlistSongs] = useState<SetlistSong[]>([]);
  const [selectedService, setSelectedService] = useState<Service | null>(null);
  const [step, setStep] = useState<WorkflowStep>("details");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [title, setTitle] = useState("");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("09:00");
  const [notes, setNotes] = useState("");
  const [playlistUrl, setPlaylistUrl] = useState("");
  const [memberId, setMemberId] = useState("");
  const [roleId, setRoleId] = useState("");
  const [songId, setSongId] = useState("");
  const [songs, setSongs] = useState<
    { id: string; title: string; artist: string | null }[]
  >([]);
  const [canManage, setCanManage] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState("");
  const [confirmArchive, setConfirmArchive] = useState(false);

  async function loadServices() {
    setLoading(true);
    const { data, error: loadError } = await supabase
      .from("services")
      .select(
        "id, title, service_date, start_time, status, notes, playlist_url, archived_at",
      )
      .is("archived_at", null)
      .order("service_date", { ascending: true });
    if (loadError) setError(loadError.message);
    else setServices((data as Service[]) || []);
    setLoading(false);
  }
  async function loadOptions() {
    const [
      { data: memberData, error: memberError },
      { data: roleData, error: roleError },
      { data: songData, error: songError },
    ] = await Promise.all([
      supabase.from("profiles").select("id, full_name").order("full_name"),
      supabase.from("music_roles").select("id, name").order("name"),
      supabase.from("songs").select("id, title, artist").order("title"),
    ]);
    if (memberError || roleError || songError)
      setError(
        memberError?.message ||
          roleError?.message ||
          songError?.message ||
          "Unable to load options.",
      );
    setMembers((memberData as Member[]) || []);
    setRoles((roleData as Role[]) || []);
    setSongs(songData || []);
  }
  async function loadAssignments(serviceId: string) {
    const { data, error: assignmentError } = await supabase
      .from("service_assignments")
      .select("id, user_id, role_id, status")
      .eq("service_id", serviceId);
    if (assignmentError) {
      setError(assignmentError.message);
      return;
    }
    setAssignments(
      (data || []).map((row) => ({
        ...row,
        memberName:
          members.find((member) => member.id === row.user_id)?.full_name ||
          "Team member",
        roleName: roles.find((role) => role.id === row.role_id)?.name || "Role",
      })),
    );
  }
  async function loadSetlist(serviceId: string) {
    const { data: setlist, error: setlistError } = await supabase
      .from("setlists")
      .select("id")
      .eq("service_id", serviceId)
      .is("archived_at", null)
      .maybeSingle();
    if (setlistError) {
      setError(setlistError.message);
      return;
    }
    if (!setlist) {
      setSetlistSongs([]);
      return;
    }
    const { data, error: songsError } = await supabase
      .from("setlist_songs")
      .select("id, song_id, position, songs(title, artist)")
      .eq("setlist_id", setlist.id)
      .order("position");
    if (songsError) {
      setError(songsError.message);
      return;
    }
    setSetlistSongs(
      (data || []).map((row: any) => ({
        id: row.id,
        song_id: row.song_id,
        position: row.position,
        title: row.songs?.title || "Song",
        artist: row.songs?.artist || null,
      })),
    );
  }
  useEffect(() => {
    void Promise.all([loadServices(), loadOptions()]);
    supabase
      .from("account_types")
      .select("account_type")
      .eq("user_id", session.user.id)
      .then(({ data }) =>
        setCanManage(
          (data || []).some((type) =>
            ["admin", "music_director"].includes(type.account_type),
          ),
        ),
      );
  }, [session.user.id]);
  useEffect(() => {
    if (selectedService && members.length)
      void loadAssignments(selectedService.id);
  }, [selectedService, members, roles]);
  useEffect(() => {
    if (selectedService) void loadSetlist(selectedService.id);
  }, [selectedService, songs]);

  async function createService(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");
    const { data, error: createError } = await supabase
      .from("services")
      .insert({
        title,
        service_date: date,
        start_time: time,
        notes: notes || null,
        playlist_url: playlistUrl || null,
        created_by: session.user.id,
      })
      .select(
        "id, title, service_date, start_time, status, notes, playlist_url",
      )
      .single();
    if (createError) setError(createError.message);
    else {
      setTitle("");
      setDate("");
      setNotes("");
      setPlaylistUrl("");
      await loadServices();
      setSelectedService(data as Service);
      setStep("lineup");
    }
    setSaving(false);
  }
  function selectService(service: Service) {
    setSelectedService(service);
    setTitle(service.title);
    setDate(service.service_date);
    setTime(service.start_time.slice(0, 5));
    setNotes(service.notes || "");
    setPlaylistUrl(service.playlist_url || "");
    setStep("lineup");
  }
  async function saveServiceDetails(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedService || !canManage || selectedService.status === "completed") return;
    setSaving(true);
    setError("");
    const { data, error: updateError } = await supabase
      .from("services")
      .update({ title, service_date: date, start_time: time, notes: notes || null, playlist_url: playlistUrl || null })
      .eq("id", selectedService.id)
      .select("id, title, service_date, start_time, status, notes, playlist_url, archived_at")
      .single();
    if (updateError) setError(updateError.message);
    else {
      setSelectedService(data as Service);
      await loadServices();
    }
    setSaving(false);
  }
  async function updateServiceStatus(status: Service["status"]) {
    if (!selectedService || !canManage || selectedService.status === "completed") return;
    setSaving(true);
    setError("");
    const { data, error: statusError } = await supabase
      .from("services")
      .update({ status })
      .eq("id", selectedService.id)
      .select("id, title, service_date, start_time, status, notes, playlist_url, archived_at")
      .single();
    if (statusError) setError(statusError.message);
    else {
      setSelectedService(data as Service);
      await loadServices();
    }
    setSaving(false);
  }
  async function assignMember(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (
      !selectedService ||
      !canManage ||
      selectedService.status === "completed"
    )
      return;
    setSaving(true);
    setError("");
    const { error: assignmentError } = await supabase
      .from("service_assignments")
      .insert({
        service_id: selectedService.id,
        user_id: memberId,
        role_id: roleId,
      });
    if (assignmentError) setError(assignmentError.message);
    else {
      setMemberId("");
      setRoleId("");
      await loadAssignments(selectedService.id);
    }
    setSaving(false);
  }
  async function addSong() {
    if (
      !selectedService ||
      !canManage ||
      selectedService.status === "completed" ||
      !songId
    )
      return;
    setSaving(true);
    setError("");
    let { data: setlist } = await supabase
      .from("setlists")
      .select("id")
      .eq("service_id", selectedService.id)
      .is("archived_at", null)
      .maybeSingle();
    if (!setlist) {
      const result = await supabase
        .from("setlists")
        .insert({ service_id: selectedService.id })
        .select("id")
        .single();
      if (result.error) {
        setError(result.error.message);
        setSaving(false);
        return;
      }
      setlist = result.data;
    }
    if (!setlist) {
      setError("Unable to create the setlist.");
      setSaving(false);
      return;
    }
    const { error: songError } = await supabase.rpc("append_setlist_song", {
      target_setlist_id: setlist.id,
      target_song_id: songId,
    });
    if (songError) setError(songError.message);
    else {
      setSongId("");
      await loadSetlist(selectedService.id);
    }
    setSaving(false);
  }
  async function archiveService() {
    if (!selectedService || !canManage) return;
    if (!confirmArchive) {
      setConfirmArchive(true);
      return;
    }
    setSaving(true);
    const { error: archiveError } = await supabase
      .from("services")
      .update({ archived_at: new Date().toISOString() })
      .eq("id", selectedService.id);
    if (archiveError) setError(archiveError.message);
    else {
      setSelectedService(null);
      await loadServices();
    }
    setConfirmArchive(false);
    setSaving(false);
  }
  async function removeAssignment(id: string) {
    if (!canManage || selectedService?.status === "completed") return;
    if (confirmRemove !== id) {
      setConfirmRemove(id);
      return;
    }
    setSaving(true);
    const { error: removeError } = await supabase
      .from("service_assignments")
      .delete()
      .eq("id", id);
    setError(removeError?.message || "Lineup member removed.");
    setConfirmRemove("");
    if (!removeError && selectedService)
      await loadAssignments(selectedService.id);
    setSaving(false);
  }
  async function removeSetlistSong(id: string) {
    if (!canManage || selectedService?.status === "completed") return;
    if (confirmRemove !== id) {
      setConfirmRemove(id);
      return;
    }
    setSaving(true);
    const { error } = await supabase
      .from("setlist_songs")
      .delete()
      .eq("id", id);
    setError(error?.message || "Song removed from setlist.");
    setConfirmRemove("");
    if (!error && selectedService) await loadSetlist(selectedService.id);
    setSaving(false);
  }

  return (
    <section className="services-view">
      <button className="back-link" onClick={onBack}>
        &lt;- Dashboard
      </button>
      <div className="services-heading">
        <div>
          <p className="eyebrow">SERVICE WORKSPACE</p>
          <h1>Services</h1>
          <p>Complete each service from the topic to the team and setlist.</p>
        </div>
        <span className="database-badge">LIVE FROM SUPABASE</span>
      </div>
      <div className="service-stepper">
        <button
          className={step === "details" ? "step active" : "step"}
          onClick={() => setStep("details")}
        >
          <b>01</b>
          <span>Service details</span>
          <small>Topic, date and time</small>
        </button>
        <button
          className={step === "lineup" ? "step active" : "step"}
          disabled={!selectedService}
          onClick={() => setStep("lineup")}
        >
          <b>02</b>
          <span>Team lineup</span>
          <small>Who will play</small>
        </button>
        <button
          className={step === "setlist" ? "step active" : "step"}
          disabled={!selectedService}
          onClick={() => setStep("setlist")}
        >
          <b>03</b>
          <span>Setlist</span>
          <small>Songs for the service</small>
        </button>
      </div>
      {step === "details" && (
        <div className="services-layout">
          <div className="service-table panel">
            <div className="panel-heading">
              <div>
                <p className="eyebrow">YOUR DRAFTS</p>
                <h2>Choose a service</h2>
              </div>
              <button
                className="more-button"
                onClick={() => void loadServices()}
              >
                Refresh <span>-&gt;</span>
              </button>
            </div>
            {loading ? (
              <p className="service-empty">Loading services...</p>
            ) : services.length === 0 ? (
              <p className="service-empty">No services yet.</p>
            ) : (
              <div className="service-list">
                {services.map((service) => (
                  <button
                    className={
                      selectedService?.id === service.id
                        ? "service-row selected"
                        : "service-row"
                    }
                    key={service.id}
                    onClick={() => {
                      selectService(service);
                    }}
                  >
                    <time>
                      {new Date(service.service_date + "T00:00:00")
                        .toLocaleDateString("en-US", {
                          month: "short",
                          day: "2-digit",
                        })
                        .toUpperCase()}
                    </time>
                    <span className="service-info">
                      <strong>{service.title}</strong>
                      <small>{service.start_time.slice(0, 5)}</small>
                    </span>
                    <span className={"status " + service.status}>
                      {service.status}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
          {canManage && !selectedService && (
            <form className="create-service panel" onSubmit={createService}>
              <p className="eyebrow">START A DRAFT</p>
              <h2>New service</h2>
              <p className="form-help">
                Begin here. Add the topic, description, and music link.
              </p>
              <label>
                Topic or service name
                <input
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                  placeholder="Example: Sunday Worship"
                  required
                />
              </label>
              <label>
                Date
                <input
                  type="date"
                  value={date}
                  onChange={(event) => setDate(event.target.value)}
                  required
                />
              </label>
              <label>
                Start time
                <input
                  type="time"
                  value={time}
                  onChange={(event) => setTime(event.target.value)}
                  required
                />
              </label>
              <label>
                Description
                <textarea
                  value={notes}
                  onChange={(event) => setNotes(event.target.value)}
                  placeholder="What should the team know?"
                />
              </label>
              <label>
                Playlist link
                <input
                  type="url"
                  value={playlistUrl}
                  onChange={(event) => setPlaylistUrl(event.target.value)}
                  placeholder="https://..."
                />
              </label>
              {error && <p className="form-error">{error}</p>}
              <button className="auth-submit" type="submit" disabled={saving}>
                {saving ? "Creating..." : "Create draft and continue"}{" "}
                <span>-&gt;</span>
              </button>
            </form>
          )}
        </div>
      )}
      {selectedService && step === "details" && (
        <form className="panel service-details-form" onSubmit={saveServiceDetails}>
          <div className="panel-heading">
            <div>
              <p className="eyebrow">EDIT SERVICE DETAILS</p>
              <h2>{selectedService.title}</h2>
            </div>
            <button className="more-button" type="button" onClick={() => setStep("lineup")}>Back to workflow</button>
          </div>
          <label>Topic or service name<input value={title} onChange={(event) => setTitle(event.target.value)} required disabled={!canManage || selectedService.status === "completed"} /></label>
          <label>Date<input type="date" value={date} onChange={(event) => setDate(event.target.value)} required disabled={!canManage || selectedService.status === "completed"} /></label>
          <label>Start time<input type="time" value={time} onChange={(event) => setTime(event.target.value)} required disabled={!canManage || selectedService.status === "completed"} /></label>
          <label>Description<textarea value={notes} onChange={(event) => setNotes(event.target.value)} disabled={!canManage || selectedService.status === "completed"} /></label>
          <label>Playlist link<input type="url" value={playlistUrl} onChange={(event) => setPlaylistUrl(event.target.value)} disabled={!canManage || selectedService.status === "completed"} /></label>
          {error && <p className="form-error">{error}</p>}
          {canManage && selectedService.status !== "completed" && <button className="primary-button" type="submit" disabled={saving}>{saving ? "Saving..." : "Save service details"}</button>}
        </form>
      )}
      {selectedService && step !== "details" && (
        <>
          <div className="selected-service-bar">
            <div>
              <p className="eyebrow">CURRENT DRAFT</p>
              <strong>{selectedService.title}</strong>
              <span>
                {selectedService.service_date} at{" "}
                {selectedService.start_time.slice(0, 5)}
              </span>
            </div>
            {canManage && (
              <div className="service-status-actions">
                <button type="button" onClick={() => setStep("details")}>Edit details</button>
                <button type="button" className={selectedService.status === "draft" ? "selected" : ""} onClick={() => void updateServiceStatus("draft")} disabled={saving || selectedService.status === "completed"}>Draft</button>
                <button type="button" className={selectedService.status === "published" ? "selected" : ""} onClick={() => void updateServiceStatus("published")} disabled={saving || selectedService.status === "completed"}>Publish</button>
                <button type="button" className={selectedService.status === "completed" ? "selected" : ""} onClick={() => void updateServiceStatus("completed")} disabled={saving || selectedService.status === "completed"}>Complete</button>
                <button type="button" className="danger-button" onClick={() => void archiveService()} disabled={saving}>{confirmArchive ? "Confirm archive" : "Archive"}</button>
              </div>
            )}
          </div>
          {step === "lineup" && (
            <section className="panel workflow-panel">
              <div className="panel-heading">
                <div>
                  <p className="eyebrow">STEP 02</p>
                  <h2>Build the team lineup</h2>
                  <p className="form-help">
                    Choose each member and the role they will play.
                  </p>
                </div>
                <span className="status">{assignments.length} assigned</span>
              </div>
              {canManage && selectedService.status !== "completed" ? (
                <form className="assignment-form" onSubmit={assignMember}>
                  <select
                    value={memberId}
                    onChange={(event) => setMemberId(event.target.value)}
                    required
                  >
                    <option value="">Select member</option>
                    {members.map((member) => (
                      <option value={member.id} key={member.id}>
                        {member.full_name}
                      </option>
                    ))}
                  </select>
                  <select
                    value={roleId}
                    onChange={(event) => setRoleId(event.target.value)}
                    required
                  >
                    <option value="">Select music role</option>
                    {roles.map((role) => (
                      <option value={role.id} key={role.id}>
                        {role.name}
                      </option>
                    ))}
                  </select>
                  <button
                    className="primary-button"
                    type="submit"
                    disabled={saving}
                  >
                    Add to lineup
                  </button>
                </form>
              ) : (
                <p className="service-empty">
                  This service is view-only for your account.
                </p>
              )}
              {assignments.length === 0 ? (
                <p className="service-empty">No members assigned yet.</p>
              ) : (
                <div className="assignment-list">
                  {assignments.map((assignment) => (
                    <div className="member-row" key={assignment.id}>
                      <span className="avatar">
                        {assignment.memberName.slice(0, 2).toUpperCase()}
                      </span>
                      <span className="service-info">
                        <strong>{assignment.memberName}</strong>
                        <small>{assignment.roleName}</small>
                      </span>
                      <span className="status pending">
                        {assignment.status}
                      </span>
                      {canManage && selectedService.status !== "completed" && (
                        <button
                          className="remove-lineup-button"
                          onClick={() => void removeAssignment(assignment.id)}
                          disabled={saving}
                        >
                          {confirmRemove === assignment.id
                            ? "Confirm remove"
                            : "Remove"}
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
              <button
                className="next-step-button"
                onClick={() => setStep("setlist")}
              >
                Continue to setlist <span>-&gt;</span>
              </button>
            </section>
          )}
          {step === "setlist" && (
            <section className="panel workflow-panel">
              <div className="panel-heading">
                <div>
                  <p className="eyebrow">STEP 03</p>
                  <h2>Build the setlist</h2>
                  <p className="form-help">
                    Add the songs this team will play.
                  </p>
                </div>
                <span className="status">{setlistSongs.length} songs</span>
              </div>
              {canManage && selectedService.status !== "completed" ? (
                <div className="assignment-form">
                  <select
                    value={songId}
                    onChange={(event) => setSongId(event.target.value)}
                  >
                    <option value="">Select a song</option>
                    {songs.map((song) => (
                      <option value={song.id} key={song.id}>
                        {song.title}
                        {song.artist ? ` - ${song.artist}` : ""}
                      </option>
                    ))}
                  </select>
                  <button
                    className="primary-button"
                    disabled={!songId || saving}
                    onClick={() => void addSong()}
                  >
                    Add song
                  </button>
                </div>
              ) : (
                <p className="service-empty">
                  This setlist is view-only for your account.
                </p>
              )}
              {setlistSongs.length === 0 ? (
                <p className="service-empty">No songs added yet.</p>
              ) : (
                <div className="song-list">
                  {setlistSongs.map((song) => (
                    <div className="song-row" key={song.id}>
                      <span className="song-mark">{song.position}</span>
                      <span className="service-info">
                        <strong>{song.title}</strong>
                        <small>{song.artist || "Artist not added"}</small>
                      </span>
                      {canManage && selectedService.status !== "completed" && (
                        <button
                          className="remove-lineup-button"
                          onClick={() => void removeSetlistSong(song.id)}
                          disabled={saving}
                        >
                          {confirmRemove === song.id
                            ? "Confirm remove"
                            : "Remove"}
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
              <button
                className="next-step-button"
                onClick={() => setStep("details")}
              >
                Back to service details
              </button>
            </section>
          )}
        </>
      )}
    </section>
  );
}
