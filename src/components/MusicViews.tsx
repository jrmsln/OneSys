import { useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "../lib/supabase";
import { PlaylistImportModal } from "./PlaylistImportModal";
import { ChordProChartModal } from "./ChordProChartModal";

interface Song {
  id: string;
  title: string;
  artist: string | null;
  source_url: string | null;
  lyrics: string | null;
  chords: string | null;
  song_key: string | null;
  notation_mode: "chords" | "nashville";
  chart_sections: { name: string; lyrics: string; chords: string }[] | null;
  chordpro_source: string | null;
}

function songKey(title: string, artist: string | null) {
  return `${title.trim().replace(/\s+/g, " ").toLowerCase()}::${(artist || "").trim().replace(/\s+/g, " ").toLowerCase()}`;
}

export function SongsView({
  session,
  onBack,
}: {
  session: Session;
  onBack: () => void;
}) {
  const [songs, setSongs] = useState<Song[]>([]);
  const [title, setTitle] = useState("");
  const [artist, setArtist] = useState("");
  const [sourceUrl, setSourceUrl] = useState("");
  const [message, setMessage] = useState("");
  const [importOpen, setImportOpen] = useState(false);
  const [selectedSong, setSelectedSong] = useState<Song | null>(null);
  const [canEditCharts, setCanEditCharts] = useState(false);
  const [activeTab, setActiveTab] = useState<"library" | "edit">("library");
  const [editorSongId, setEditorSongId] = useState("");
  const [search, setSearch] = useState("");
  async function load() {
    const { data, error } = await supabase
      .from("songs")
      .select(
        "id, title, artist, source_url, lyrics, chords, song_key, notation_mode, chart_sections, chordpro_source",
      )
      .order("title");
    if (error) setMessage(error.message);
    else setSongs((data as Song[]) || []);
  }
  useEffect(() => {
    void load();
  }, []);
  useEffect(() => {
    Promise.all([
      supabase.from("account_types").select("account_type").eq("user_id", session.user.id),
      supabase.rpc("can_edit_committed_music"),
    ]).then(([accountResult, committedResult]) => {
      const leader = (accountResult.data || []).some((type) => ["admin", "music_director"].includes(type.account_type));
      setCanEditCharts(leader || committedResult.data === true);
    });
  }, [session.user.id]);
  async function addSong() {
    setMessage("");
    const normalizedArtist = artist || null;
    const { data: existingSongs, error: lookupError } = await supabase
      .from("songs")
      .select("title, artist");
    if (lookupError) {
      setMessage(lookupError.message);
      return;
    }
    if (
      (existingSongs || []).some(
        (song) =>
          songKey(song.title, song.artist) === songKey(title, normalizedArtist),
      )
    ) {
      setMessage("That song is already in your library.");
      return;
    }
    const { error } = await supabase
      .from("songs")
      .insert({
        title,
        artist: normalizedArtist,
        source_url: sourceUrl || null,
        created_by: session.user.id,
      });
    if (error) setMessage(error.message);
    else {
      setTitle("");
      setArtist("");
      setSourceUrl("");
      setMessage("Song added.");
      await load();
    }
  }
  const filteredSongs = songs.filter((song) => {
    const query = search.trim().toLowerCase();
    if (!query) return true;
    return [song.title, song.artist, song.lyrics, song.chords, song.chordpro_source]
      .filter(Boolean)
      .some((value) => value!.toLowerCase().includes(query));
  });
  return (
    <section className="services-view">
      <button className="back-link" onClick={onBack}>
        &lt;- Dashboard
      </button>
      <div className="services-heading">
        <div>
          <p className="eyebrow">MUSIC LIBRARY</p>
          <h1>Songs</h1>
          <p>Keep lyrics and chords ready for every service.</p>
        </div>
        <span className="database-badge">LIVE FROM SUPABASE</span>
      </div>
      <div className="songs-tabs" role="tablist" aria-label="Songs workspace">
        <button className={activeTab === "library" ? "songs-tab active" : "songs-tab"} role="tab" aria-selected={activeTab === "library"} onClick={() => setActiveTab("library")}>Song Library</button>
        {canEditCharts && <button className={activeTab === "edit" ? "songs-tab active" : "songs-tab"} role="tab" aria-selected={activeTab === "edit"} onClick={() => setActiveTab("edit")}>Edit Song</button>}
      </div>
      {activeTab === "edit" && <div className="panel chart-workspace">
        <p className="eyebrow">EDIT SONG CHORDS AND LYRICS</p>
        <h2>Choose a song to edit</h2>
        <p className="form-help">Open the ChordPro editor to organize sections, preview the chart, and save the finalized version.</p>
        {songs.length ? <div className="chart-workspace-actions"><select value={editorSongId} onChange={(event) => setEditorSongId(event.target.value)}><option value="">Select a song</option>{songs.map((song) => <option value={song.id} key={song.id}>{song.title}{song.artist ? ` - ${song.artist}` : ""}</option>)}</select><button className="primary-button" disabled={!editorSongId} onClick={() => setSelectedSong(songs.find((song) => song.id === editorSongId) || null)}>Open editor</button></div> : <p className="service-empty">Add a song to begin editing its chart.</p>}
      </div>}
      <div className={activeTab === "library" ? "music-layout" : "music-layout songs-library-hidden"}>
        <div className="panel">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">YOUR LIBRARY</p>
              <h2>{filteredSongs.length} of {songs.length} songs</h2>
            </div>
            <div className="panel-actions">
              <button className="more-button" onClick={() => void load()}>
                Refresh
              </button>
              {canEditCharts && <button
                className="primary-button"
                onClick={() => setImportOpen(true)}
              >
                Import playlist
              </button>}
            </div>
          </div>
          <label className="song-search"><span className="sr-only">Search songs, artists, lyrics, or chords</span><input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search songs, artists, lyrics, or chords" /></label>
          {songs.length === 0 ? (
            <p className="service-empty">
              No songs yet. Add the first song to your library.
            </p>
          ) : filteredSongs.length === 0 ? (
            <p className="service-empty">No songs match your search.</p>
          ) : (
            <div className="song-list">
              {filteredSongs.map((song) => (
                    <div
                  key={song.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => setSelectedSong(song)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ")
                      setSelectedSong(song);
                  }}
                >
                  <span className="song-mark">~</span>
                  <span className="service-info">
                    <strong>{song.title}</strong>
                    <small>{song.artist || "Artist not added"}</small>
                  </span>
                  {song.source_url ? (
                    <a
                      className="source-link"
                      href={song.source_url}
                    >
                      Open source
                    </a>
                  ) : (
                    <span className="row-arrow">-&gt;</span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
        {canEditCharts && <div className="panel create-song">
          <p className="eyebrow">NEW SONG</p>
          <h2>Add to library</h2>
          <label>
            Title
            <input
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="Song title"
            />
          </label>
          <label>
            Artist <span>(optional)</span>
            <input
              value={artist}
              onChange={(event) => setArtist(event.target.value)}
              placeholder="Artist or writer"
            />
          </label>
          <label>
            Playlist link <span>(optional)</span>
            <input
              type="url"
              value={sourceUrl}
              onChange={(event) => setSourceUrl(event.target.value)}
              placeholder="https://..."
            />
          </label>
          {message && <p className="form-error">{message}</p>}
          <button
            className="primary-button"
            disabled={!title}
            onClick={() => void addSong()}
          >
            Add song
          </button>
        </div>}
      </div>
      {importOpen && (
        <PlaylistImportModal
          onClose={() => setImportOpen(false)}
          onImported={() => void load()}
        />
      )}
      {selectedSong && (
        <ChordProChartModal
          song={selectedSong}
          canEdit={canEditCharts}
          onClose={() => setSelectedSong(null)}
          onSaved={(updatedSong) => {
            setSongs((current) =>
              current.map((song) =>
                song.id === updatedSong.id ? updatedSong : song,
              ),
            );
            setSelectedSong(updatedSong);
          }}
        />
      )}
    </section>
  );
}
