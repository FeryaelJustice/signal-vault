"use client";

import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { formatDistanceToNow } from "@/lib/utils/date";

import {
  apiGetNotes,
  apiCreateNote,
  apiUpdateNote,
  apiDeleteNote,
} from "@/lib/api/client";
import { useVaultStore } from "@/lib/vault/vaultStore";
import {
  encryptWithKey,
  decryptWithKey,
  encryptString,
  decryptString,
} from "@/lib/crypto/vault";
import type { Note } from "@/lib/api/contract";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface DecryptedNote {
  id: string;
  title: string;
  content: string;
  createdAt: string;
  updatedAt: string;
  highSecurity: boolean;
  isDecrypted: boolean;
  encryptedContent: string;
}

type DialogMode = "create" | "view" | "edit";

export function NotesList() {
  const { vaultKey, saltHex } = useVaultStore();
  const qc = useQueryClient();

  const [openNote, setOpenNote] = useState<DecryptedNote | null>(null);
  const [dialogMode, setDialogMode] = useState<DialogMode>("create");
  const [isCreating, setIsCreating] = useState(false);
  const [decryptedNotes, setDecrypted] = useState<DecryptedNote[]>([]);
  const [decryptError, setDecryptError] = useState<string | null>(null);

  const [unlockingNote, setUnlockingNote] = useState<DecryptedNote | null>(null);
  const [activeNotePassword, setActiveNotePassword] = useState<string | null>(null);

  const { data: rawNotes, isLoading, error } = useQuery({
    queryKey: ["notes"],
    queryFn: apiGetNotes,
    enabled: !!vaultKey,
  });

  useEffect(() => {
    if (!rawNotes || !vaultKey) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setDecrypted([]);
      return;
    }

    let cancelled = false;

    async function decryptAll(notes: Note[], key: CryptoKey) {
      const results: DecryptedNote[] = [];
      for (const note of notes) {
        if (note.highSecurity) {
          results.push({ ...note, content: "", isDecrypted: false, encryptedContent: note.encryptedContent });
        } else {
          try {
            const content = await decryptWithKey(note.encryptedContent, key);
            results.push({ ...note, content, isDecrypted: true, encryptedContent: note.encryptedContent });
          } catch {
            results.push({ ...note, content: "", isDecrypted: false, encryptedContent: note.encryptedContent });
          }
        }
      }
      return results;
    }

    decryptAll(rawNotes, vaultKey)
      .then((notes) => { if (!cancelled) { setDecrypted(notes); setDecryptError(null); } })
      .catch(() => { if (!cancelled) setDecryptError("Decryption error"); });

    return () => { cancelled = true; };
  }, [rawNotes, vaultKey]);

  const createMutation = useMutation({
    mutationFn: async ({ title, content, highSecurity, notePassword }: {
      title: string; content: string; highSecurity: boolean; notePassword?: string;
    }) => {
      if (highSecurity && notePassword) {
        const encryptedContent = await encryptString(content, notePassword);
        return apiCreateNote({ title, encryptedContent, highSecurity: true });
      }
      if (!vaultKey || !saltHex) throw new Error("Vault locked");
      const encryptedContent = await encryptWithKey(content, vaultKey, saltHex);
      return apiCreateNote({ title, encryptedContent, highSecurity: false });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["notes"] });
      toast.success("Note created");
      setIsCreating(false);
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Failed to create note"),
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, title, content, highSecurity, notePassword }: {
      id: string; title: string; content: string; highSecurity: boolean; notePassword?: string;
    }) => {
      if (!vaultKey || !saltHex) throw new Error("Vault locked");
      let encryptedContent: string;
      if (highSecurity && notePassword) {
        encryptedContent = await encryptString(content, notePassword);
      } else if (highSecurity && activeNotePassword) {
        encryptedContent = await encryptString(content, activeNotePassword);
      } else {
        encryptedContent = await encryptWithKey(content, vaultKey, saltHex);
      }
      return apiUpdateNote(id, { title, encryptedContent, highSecurity });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["notes"] });
      toast.success("Note saved");
      setOpenNote(null);
      setActiveNotePassword(null);
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Failed to save note"),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiDeleteNote(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["notes"] });
      toast.success("Note deleted");
      setOpenNote(null);
      setActiveNotePassword(null);
    },
    onError: () => toast.error("Failed to delete note"),
  });

  function handleNoteClick(note: DecryptedNote) {
    if (note.highSecurity && !note.isDecrypted) {
      setUnlockingNote(note);
    } else {
      setOpenNote(note);
      setDialogMode("view");
    }
  }

  async function handleNoteUnlock(password: string) {
    if (!unlockingNote) return false;
    try {
      const content = await decryptString(unlockingNote.encryptedContent, password);
      setActiveNotePassword(password);
      const unlocked = { ...unlockingNote, content, isDecrypted: true };
      setUnlockingNote(null);
      setOpenNote(unlocked);
      setDialogMode("view");
      return true;
    } catch {
      return false;
    }
  }

  function handleCloseNote() {
    setOpenNote(null);
    setActiveNotePassword(null);
  }

  if (isLoading) {
    return (
      <div className="space-y-2">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-14 animate-pulse rounded-lg bg-muted" aria-hidden="true" />
        ))}
        <p className="sr-only">Loading notes…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
        Failed to load notes: {error instanceof Error ? error.message : "Unknown error"}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-widest">
          Notes ({decryptedNotes.length})
        </h2>
        <Button size="sm" onClick={() => setIsCreating(true)} variant="outline">
          <PlusIcon className="mr-1.5 h-3.5 w-3.5" />
          New note
        </Button>
      </div>

      {decryptError && <p className="text-xs text-destructive">{decryptError}</p>}

      {decryptedNotes.length === 0 && !isLoading && (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-border py-16 text-center">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted">
            <FileIcon className="h-5 w-5 text-muted-foreground" />
          </div>
          <div>
            <p className="text-sm font-medium">No notes yet</p>
            <p className="mt-0.5 text-xs text-muted-foreground">Create your first encrypted note</p>
          </div>
          <Button size="sm" onClick={() => setIsCreating(true)} variant="outline">Create note</Button>
        </div>
      )}

      <ul className="space-y-1.5" role="list">
        {decryptedNotes.map((note) => (
          <li key={note.id}>
            <button
              type="button"
              onClick={() => handleNoteClick(note)}
              className="group w-full cursor-pointer rounded-lg border border-border/60 bg-card/60 px-4 py-3 text-left transition-colors hover:border-border hover:bg-card focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              aria-label={`Open ${note.title}`}
            >
              <div className="flex items-center justify-between gap-3">
                <div className="flex min-w-0 items-center gap-2">
                  <span className="truncate text-sm font-medium">{note.title}</span>
                  {note.highSecurity && (
                    <span className="flex shrink-0 items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary">
                      <ShieldIcon className="h-3 w-3" />
                      Protected
                    </span>
                  )}
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <time className="text-xs text-muted-foreground/70">
                    {formatDistanceToNow(note.updatedAt)}
                  </time>
                  <ChevronIcon className="h-3.5 w-3.5 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-60" />
                </div>
              </div>
            </button>
          </li>
        ))}
      </ul>

      {/* Password unlock dialog for high-security notes */}
      <NotePasswordDialog
        open={!!unlockingNote}
        noteTitle={unlockingNote?.title ?? ""}
        onClose={() => setUnlockingNote(null)}
        onUnlock={handleNoteUnlock}
      />

      {/* View / Edit modal */}
      {openNote && (
        <NoteViewEditDialog
          open={!!openNote}
          note={openNote}
          initialMode={dialogMode}
          activeNotePassword={activeNotePassword ?? undefined}
          isSaving={updateMutation.isPending}
          isDeleting={deleteMutation.isPending}
          onClose={handleCloseNote}
          onSave={(title, content, highSecurity, notePassword) =>
            updateMutation.mutate({ id: openNote.id, title, content, highSecurity, notePassword })
          }
          onDelete={() => deleteMutation.mutate(openNote.id)}
        />
      )}

      {/* Create modal */}
      <NoteCreateDialog
        open={isCreating}
        onClose={() => setIsCreating(false)}
        onSave={(title, content, highSecurity, notePassword) =>
          createMutation.mutate({ title, content, highSecurity, notePassword })
        }
        isSaving={createMutation.isPending}
      />
    </div>
  );
}

// ── Note password unlock dialog ───────────────────────────────────────────────

function NotePasswordDialog({ open, noteTitle, onClose, onUnlock }: {
  open: boolean; noteTitle: string; onClose: () => void;
  onUnlock: (password: string) => Promise<boolean>;
}) {
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);

  useEffect(() => {
    if (open) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setPassword("");
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setError(null);
    }
  }, [open]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!password) return;
    setChecking(true);
    setError(null);
    const ok = await onUnlock(password);
    setChecking(false);
    if (!ok) setError("Wrong password. Please try again.");
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-xs">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShieldIcon className="h-4 w-4 text-primary" />
            Protected note
          </DialogTitle>
        </DialogHeader>
        <p className="text-xs text-muted-foreground">
          <span className="font-medium">{noteTitle}</span> requires its own password.
        </p>
        <form onSubmit={handleSubmit} className="space-y-3 py-1">
          <Input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Note password"
            autoFocus
          />
          {error && <p className="text-xs text-destructive">{error}</p>}
          <div className="flex justify-end gap-2">
            <Button variant="ghost" type="button" onClick={onClose} disabled={checking}>Cancel</Button>
            <Button type="submit" disabled={checking || !password}>
              {checking ? "Checking…" : "Unlock"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ── Note view / edit dialog ───────────────────────────────────────────────────

function NoteViewEditDialog({ open, note, initialMode, activeNotePassword, isSaving, isDeleting, onClose, onSave, onDelete }: {
  open: boolean;
  note: DecryptedNote;
  initialMode: DialogMode;
  activeNotePassword?: string;
  isSaving: boolean;
  isDeleting: boolean;
  onClose: () => void;
  onSave: (title: string, content: string, highSecurity: boolean, notePassword?: string) => void;
  onDelete: () => void;
}) {
  const [mode, setMode] = useState<"view" | "edit">(initialMode === "view" ? "view" : "edit");
  const [noteTitle, setNoteTitle] = useState(note.title);
  const [noteContent, setNoteContent] = useState(note.content);
  const [highSecurity, setHighSecurity] = useState(note.highSecurity);
  const [notePassword, setNotePassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPasswordWarning, setShowPasswordWarning] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    if (open) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setMode(initialMode === "view" ? "view" : "edit");
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setNoteTitle(note.title);
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setNoteContent(note.content);
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setHighSecurity(note.highSecurity);
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setNotePassword("");
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setConfirmPassword("");
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setShowPasswordWarning(false);
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setConfirmDelete(false);
    }
  }, [open, note, initialMode]);

  const isAlreadyHighSecurity = note.highSecurity && !!activeNotePassword;
  const enablingNewHighSecurity = highSecurity && !note.highSecurity;
  const needsNewPassword = enablingNewHighSecurity;
  const passwordMismatch = needsNewPassword && notePassword && confirmPassword && notePassword !== confirmPassword;
  const canSave =
    !!noteTitle.trim() &&
    (!needsNewPassword || (notePassword.length >= 8 && notePassword === confirmPassword));

  function handleHighSecurityToggle(checked: boolean) {
    setHighSecurity(checked);
    setShowPasswordWarning(checked && !note.highSecurity);
    if (!checked || note.highSecurity) {
      setNotePassword("");
      setConfirmPassword("");
    }
  }

  function handleSave() {
    if (!canSave) return;
    if (needsNewPassword) {
      onSave(noteTitle.trim(), noteContent, true, notePassword);
    } else {
      onSave(noteTitle.trim(), noteContent, highSecurity, undefined);
    }
  }

  function switchToEdit() {
    setMode("edit");
    setNoteTitle(note.title);
    setNoteContent(note.content);
  }

  function cancelEdit() {
    setMode("view");
    setNoteTitle(note.title);
    setNoteContent(note.content);
    setHighSecurity(note.highSecurity);
    setNotePassword("");
    setConfirmPassword("");
    setShowPasswordWarning(false);
    setConfirmDelete(false);
  }

  const busy = isSaving || isDeleting;

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center justify-between gap-3 pr-6">
            <DialogTitle className="truncate">
              {mode === "view" ? note.title : (mode === "edit" ? "Edit note" : note.title)}
            </DialogTitle>
            {/* Edit mode toggle — only in view mode */}
            {mode === "view" && (
              <div className="flex shrink-0 items-center gap-2">
                <span className="text-xs text-muted-foreground">Edit</span>
                <button
                  type="button"
                  role="switch"
                  aria-checked={false}
                  onClick={switchToEdit}
                  className="relative inline-flex h-5 w-9 cursor-pointer items-center rounded-full bg-muted-foreground/30 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <span className="inline-block h-3.5 w-3.5 translate-x-0.5 transform rounded-full bg-white transition-transform" />
                </button>
              </div>
            )}
            {/* Back to view — in edit mode */}
            {mode === "edit" && (
              <div className="flex shrink-0 items-center gap-2">
                <span className="text-xs text-primary">Edit</span>
                <button
                  type="button"
                  role="switch"
                  aria-checked={true}
                  onClick={cancelEdit}
                  disabled={busy}
                  className="relative inline-flex h-5 w-9 cursor-pointer items-center rounded-full bg-primary transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
                >
                  <span className="inline-block h-3.5 w-3.5 translate-x-4 transform rounded-full bg-white transition-transform" />
                </button>
              </div>
            )}
          </div>
        </DialogHeader>

        {/* ── VIEW MODE ── */}
        {mode === "view" && (
          <div className="space-y-3 py-1">
            {note.highSecurity && (
              <div className="flex items-center gap-1.5 text-xs text-primary">
                <ShieldIcon className="h-3 w-3" />
                <span>Protected note</span>
              </div>
            )}
            <div className="min-h-[120px] rounded-md border border-border/40 bg-muted/20 px-3 py-2.5">
              {note.content ? (
                <p className="whitespace-pre-wrap text-sm leading-relaxed">{note.content}</p>
              ) : (
                <p className="text-sm italic text-muted-foreground/50">Empty note</p>
              )}
            </div>
            <time className="block text-xs text-muted-foreground/60">
              Updated {formatDistanceToNow(note.updatedAt)}
            </time>
          </div>
        )}

        {/* ── EDIT MODE ── */}
        {mode === "edit" && (
          <div className="space-y-3 py-2">
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground" htmlFor="note-title">Title</label>
              <Input
                id="note-title"
                value={noteTitle}
                onChange={(e) => setNoteTitle(e.target.value)}
                placeholder="Note title"
                autoFocus
                disabled={busy}
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground" htmlFor="note-content">Content</label>
              <textarea
                id="note-content"
                value={noteContent}
                onChange={(e) => setNoteContent(e.target.value)}
                placeholder="Write something private…"
                rows={6}
                disabled={busy}
                className="w-full resize-none rounded-md border border-input bg-transparent px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
              />
            </div>

            {/* High-security toggle */}
            <div className="flex items-center justify-between rounded-lg border border-border/60 bg-card/40 px-3 py-2.5">
              <div className="flex items-center gap-2">
                <ShieldIcon className="h-4 w-4 text-primary" />
                <div>
                  <p className="text-xs font-medium">Maximum security</p>
                  <p className="text-[10px] text-muted-foreground">Separate password for this note</p>
                </div>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={highSecurity}
                onClick={() => handleHighSecurityToggle(!highSecurity)}
                disabled={busy}
                className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50 ${
                  highSecurity ? "bg-primary" : "bg-muted-foreground/30"
                }`}
              >
                <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${
                  highSecurity ? "translate-x-4" : "translate-x-0.5"
                }`} />
              </button>
            </div>

            {showPasswordWarning && (
              <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-xs text-destructive">
                <strong>Warning:</strong> Write this password down. If you lose it, this note is permanently unrecoverable.
              </div>
            )}

            {needsNewPassword && (
              <div className="space-y-2">
                <Input
                  type="password"
                  value={notePassword}
                  onChange={(e) => setNotePassword(e.target.value)}
                  placeholder="Note password (min. 8 chars)"
                  autoComplete="new-password"
                  disabled={busy}
                />
                <Input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Confirm password"
                  autoComplete="new-password"
                  disabled={busy}
                />
                {passwordMismatch && <p className="text-xs text-destructive">Passwords do not match</p>}
              </div>
            )}

            {isAlreadyHighSecurity && !needsNewPassword && (
              <p className="flex items-center gap-1 text-xs text-primary/80">
                <ShieldIcon className="h-3 w-3" />
                Saved with your note password. Disable the toggle to revert to vault encryption.
              </p>
            )}

            {/* Delete confirmation */}
            {confirmDelete ? (
              <div className="flex items-center justify-between rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2">
                <p className="text-xs text-destructive">Delete this note permanently?</p>
                <div className="flex gap-2">
                  <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={() => setConfirmDelete(false)} disabled={busy}>
                    No
                  </Button>
                  <Button size="sm" variant="ghost" className="h-7 px-2 text-xs text-destructive hover:text-destructive" onClick={onDelete} disabled={busy}>
                    {isDeleting ? "Deleting…" : "Yes, delete"}
                  </Button>
                </div>
              </div>
            ) : null}
          </div>
        )}

        {/* ── Footer ── */}
        {mode === "view" && (
          <div className="flex justify-end">
            <Button variant="ghost" onClick={onClose}>Close</Button>
          </div>
        )}

        {mode === "edit" && (
          <div className="flex items-center justify-between">
            <Button
              variant="ghost"
              size="sm"
              className="text-destructive hover:text-destructive"
              onClick={() => setConfirmDelete(true)}
              disabled={busy || confirmDelete}
            >
              Delete
            </Button>
            <div className="flex gap-2">
              <Button variant="ghost" onClick={cancelEdit} disabled={busy}>Cancel</Button>
              <Button onClick={handleSave} disabled={busy || !canSave}>
                {isSaving ? "Saving…" : "Save"}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

// ── Note create dialog ────────────────────────────────────────────────────────

function NoteCreateDialog({ open, onClose, onSave, isSaving }: {
  open: boolean;
  onClose: () => void;
  onSave: (title: string, content: string, highSecurity: boolean, notePassword?: string) => void;
  isSaving: boolean;
}) {
  const [noteTitle, setNoteTitle] = useState("");
  const [noteContent, setNoteContent] = useState("");
  const [highSecurity, setHighSecurity] = useState(false);
  const [notePassword, setNotePassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPasswordWarning, setShowPasswordWarning] = useState(false);

  useEffect(() => {
    if (open) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setNoteTitle("");
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setNoteContent("");
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setHighSecurity(false);
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setNotePassword("");
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setConfirmPassword("");
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setShowPasswordWarning(false);
    }
  }, [open]);

  const passwordMismatch = highSecurity && notePassword && confirmPassword && notePassword !== confirmPassword;
  const canSave =
    !!noteTitle.trim() &&
    (!highSecurity || (notePassword.length >= 8 && notePassword === confirmPassword));

  function handleHighSecurityToggle(checked: boolean) {
    setHighSecurity(checked);
    setShowPasswordWarning(checked);
    if (!checked) { setNotePassword(""); setConfirmPassword(""); }
  }

  function handleSave() {
    if (!canSave) return;
    if (highSecurity) {
      onSave(noteTitle.trim(), noteContent, true, notePassword);
    } else {
      onSave(noteTitle.trim(), noteContent, false, undefined);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>New note</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground" htmlFor="new-note-title">Title</label>
            <Input
              id="new-note-title"
              value={noteTitle}
              onChange={(e) => setNoteTitle(e.target.value)}
              placeholder="Note title"
              autoFocus
              disabled={isSaving}
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground" htmlFor="new-note-content">Content</label>
            <textarea
              id="new-note-content"
              value={noteContent}
              onChange={(e) => setNoteContent(e.target.value)}
              placeholder="Write something private…"
              rows={6}
              disabled={isSaving}
              className="w-full resize-none rounded-md border border-input bg-transparent px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
            />
          </div>

          <div className="flex items-center justify-between rounded-lg border border-border/60 bg-card/40 px-3 py-2.5">
            <div className="flex items-center gap-2">
              <ShieldIcon className="h-4 w-4 text-primary" />
              <div>
                <p className="text-xs font-medium">Maximum security</p>
                <p className="text-[10px] text-muted-foreground">Separate password for this note</p>
              </div>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={highSecurity}
              onClick={() => handleHighSecurityToggle(!highSecurity)}
              disabled={isSaving}
              className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50 ${
                highSecurity ? "bg-primary" : "bg-muted-foreground/30"
              }`}
            >
              <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${
                highSecurity ? "translate-x-4" : "translate-x-0.5"
              }`} />
            </button>
          </div>

          {showPasswordWarning && (
            <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-xs text-destructive">
              <strong>Warning:</strong> Write this password down. If you lose it, this note is permanently unrecoverable.
            </div>
          )}

          {highSecurity && (
            <div className="space-y-2">
              <Input
                type="password"
                value={notePassword}
                onChange={(e) => setNotePassword(e.target.value)}
                placeholder="Note password (min. 8 chars)"
                autoComplete="new-password"
                disabled={isSaving}
              />
              <Input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Confirm password"
                autoComplete="new-password"
                disabled={isSaving}
              />
              {passwordMismatch && <p className="text-xs text-destructive">Passwords do not match</p>}
            </div>
          )}
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose} disabled={isSaving}>Cancel</Button>
          <Button onClick={handleSave} disabled={isSaving || !canSave}>
            {isSaving ? "Saving…" : "Create"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ── Icons ─────────────────────────────────────────────────────────────────────

function PlusIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}

function FileIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="16" y1="13" x2="8" y2="13" />
      <line x1="16" y1="17" x2="8" y2="17" />
    </svg>
  );
}

function ShieldIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    </svg>
  );
}

function ChevronIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <polyline points="9 18 15 12 9 6" />
    </svg>
  );
}
