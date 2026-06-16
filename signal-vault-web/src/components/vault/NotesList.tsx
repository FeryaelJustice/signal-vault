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
import { encryptWithKey, decryptWithKey } from "@/lib/crypto/vault";
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
}

export function NotesList() {
  const { vaultKey, saltHex } = useVaultStore();
  const qc = useQueryClient();

  const [editNote, setEditNote] = useState<DecryptedNote | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [decryptedNotes, setDecrypted] = useState<DecryptedNote[]>([]);
  const [decryptError, setDecryptError] = useState<string | null>(null);

  // Fetch raw encrypted notes from backend
  const {
    data: rawNotes,
    isLoading,
    error,
  } = useQuery({
    queryKey: ["notes"],
    queryFn: apiGetNotes,
    enabled: !!vaultKey,
  });

  // Decrypt notes whenever raw notes or vault key changes
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
        try {
          const content = await decryptWithKey(note.encryptedContent, key);
          results.push({ ...note, content });
        } catch {
          results.push({ ...note, content: "[Could not decrypt]" });
        }
      }
      return results;
    }

    decryptAll(rawNotes, vaultKey)
      .then((notes) => {
        if (!cancelled) {
          setDecrypted(notes);
          setDecryptError(null);
        }
      })
      .catch(() => {
        if (!cancelled) setDecryptError("Decryption error");
      });

    return () => {
      cancelled = true;
    };
  }, [rawNotes, vaultKey]);

  const createMutation = useMutation({
    mutationFn: async ({
      title,
      content,
    }: {
      title: string;
      content: string;
    }) => {
      if (!vaultKey || !saltHex) throw new Error("Vault locked");
      const encryptedContent = await encryptWithKey(content, vaultKey, saltHex);
      return apiCreateNote({ title, encryptedContent });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["notes"] });
      toast.success("Note created");
      setIsCreating(false);
    },
    onError: (err) =>
      toast.error(
        err instanceof Error ? err.message : "Failed to create note"
      ),
  });

  const updateMutation = useMutation({
    mutationFn: async ({
      id,
      title,
      content,
    }: {
      id: string;
      title: string;
      content: string;
    }) => {
      if (!vaultKey || !saltHex) throw new Error("Vault locked");
      const encryptedContent = await encryptWithKey(content, vaultKey, saltHex);
      return apiUpdateNote(id, { title, encryptedContent });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["notes"] });
      toast.success("Note saved");
      setEditNote(null);
    },
    onError: (err) =>
      toast.error(err instanceof Error ? err.message : "Failed to save note"),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiDeleteNote(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["notes"] });
      toast.success("Note deleted");
    },
    onError: () => toast.error("Failed to delete note"),
  });

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="h-20 animate-pulse rounded-lg bg-muted"
            aria-hidden="true"
          />
        ))}
        <p className="sr-only">Loading notes…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
        Failed to load notes:{" "}
        {error instanceof Error ? error.message : "Unknown error"}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header row */}
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-widest">
          Notes ({decryptedNotes.length})
        </h2>
        <Button size="sm" onClick={() => setIsCreating(true)} variant="outline">
          <PlusIcon className="mr-1.5 h-3.5 w-3.5" />
          New note
        </Button>
      </div>

      {decryptError && (
        <p className="text-xs text-destructive">{decryptError}</p>
      )}

      {/* Empty state */}
      {decryptedNotes.length === 0 && !isLoading && (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-border py-16 text-center">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted">
            <FileIcon className="h-5 w-5 text-muted-foreground" />
          </div>
          <div>
            <p className="text-sm font-medium">No notes yet</p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Create your first encrypted note
            </p>
          </div>
          <Button
            size="sm"
            onClick={() => setIsCreating(true)}
            variant="outline"
          >
            Create note
          </Button>
        </div>
      )}

      {/* Notes grid */}
      <ul className="space-y-2" role="list">
        {decryptedNotes.map((note) => (
          <li key={note.id}>
            <div className="group relative rounded-lg border border-border/60 bg-card/60 p-4 transition-colors hover:border-border hover:bg-card">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <h3 className="truncate font-medium text-sm">{note.title}</h3>
                  <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                    {note.content === "[Could not decrypt]" ? (
                      <span className="text-destructive">{note.content}</span>
                    ) : (
                      note.content
                    )}
                  </p>
                  <time className="mt-2 block text-xs text-muted-foreground/70">
                    {formatDistanceToNow(note.updatedAt)}
                  </time>
                </div>
                <div className="flex shrink-0 gap-1 opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 px-2 text-xs"
                    onClick={() => setEditNote(note)}
                    aria-label={`Edit ${note.title}`}
                  >
                    Edit
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 px-2 text-xs text-destructive hover:text-destructive"
                    onClick={() => deleteMutation.mutate(note.id)}
                    aria-label={`Delete ${note.title}`}
                    disabled={deleteMutation.isPending}
                  >
                    Delete
                  </Button>
                </div>
              </div>
            </div>
          </li>
        ))}
      </ul>

      {/* Create dialog */}
      <NoteDialog
        open={isCreating}
        onClose={() => setIsCreating(false)}
        onSave={(title, content) =>
          createMutation.mutate({ title, content })
        }
        isSaving={createMutation.isPending}
        title="Create note"
      />

      {/* Edit dialog */}
      <NoteDialog
        open={!!editNote}
        onClose={() => setEditNote(null)}
        onSave={(title, content) =>
          editNote &&
          updateMutation.mutate({ id: editNote.id, title, content })
        }
        isSaving={updateMutation.isPending}
        title="Edit note"
        defaultTitle={editNote?.title}
        defaultContent={editNote?.content}
      />
    </div>
  );
}

// ── Note dialog ───────────────────────────────────────────────────────────────

interface NoteDialogProps {
  open: boolean;
  onClose: () => void;
  onSave: (title: string, content: string) => void;
  isSaving: boolean;
  title: string;
  defaultTitle?: string;
  defaultContent?: string;
}

function NoteDialog({
  open,
  onClose,
  onSave,
  isSaving,
  title,
  defaultTitle = "",
  defaultContent = "",
}: NoteDialogProps) {
  const [noteTitle, setNoteTitle] = useState(defaultTitle);
  const [noteContent, setNoteContent] = useState(defaultContent);

  // Sync defaults when dialog is opened with new note data
  useEffect(() => {
    if (open) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setNoteTitle(defaultTitle);
      setNoteContent(defaultContent);
    }
  }, [open, defaultTitle, defaultContent]);

  function handleSave() {
    if (!noteTitle.trim()) return;
    onSave(noteTitle.trim(), noteContent);
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <div className="space-y-1">
            <label
              className="text-xs font-medium text-muted-foreground"
              htmlFor="note-title"
            >
              Title
            </label>
            <Input
              id="note-title"
              value={noteTitle}
              onChange={(e) => setNoteTitle(e.target.value)}
              placeholder="Note title"
              autoFocus
            />
          </div>
          <div className="space-y-1">
            <label
              className="text-xs font-medium text-muted-foreground"
              htmlFor="note-content"
            >
              Content
            </label>
            <textarea
              id="note-content"
              value={noteContent}
              onChange={(e) => setNoteContent(e.target.value)}
              placeholder="Write something private…"
              rows={6}
              className="w-full resize-none rounded-md border border-input bg-transparent px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
            />
          </div>
          <p className="text-xs text-muted-foreground">
            Content is encrypted before leaving your device.
          </p>
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose} disabled={isSaving}>
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            disabled={isSaving || !noteTitle.trim()}
          >
            {isSaving ? "Saving…" : "Save"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ── Icons ─────────────────────────────────────────────────────────────────────

function PlusIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}

function FileIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="16" y1="13" x2="8" y2="13" />
      <line x1="16" y1="17" x2="8" y2="17" />
      <polyline points="10 9 9 9 8 9" />
    </svg>
  );
}
