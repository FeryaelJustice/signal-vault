package com.signalvault.notes;

import com.signalvault.common.NotFoundException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.UUID;

@Service
public class NoteService {

    private final SecureNoteRepository noteRepository;

    public NoteService(SecureNoteRepository noteRepository) {
        this.noteRepository = noteRepository;
    }

    @Transactional(readOnly = true)
    public List<SecureNote> listForOwner(UUID ownerId) {
        return noteRepository.findByOwnerIdOrderByUpdatedAtDesc(ownerId);
    }

    @Transactional
    public SecureNote create(UUID ownerId, String title, String encryptedContent, boolean highSecurity) {
        SecureNote note = SecureNote.create(ownerId, title, encryptedContent, highSecurity);
        return noteRepository.save(note);
    }

    @Transactional
    public SecureNote update(UUID ownerId, UUID noteId, String title, String encryptedContent, boolean highSecurity) {
        SecureNote note = noteRepository.findByIdAndOwnerId(noteId, ownerId)
                .orElseThrow(() -> new NotFoundException("Note not found"));
        note.update(title, encryptedContent, highSecurity);
        return noteRepository.save(note);
    }

    @Transactional
    public void delete(UUID ownerId, UUID noteId) {
        SecureNote note = noteRepository.findByIdAndOwnerId(noteId, ownerId)
                .orElseThrow(() -> new NotFoundException("Note not found"));
        noteRepository.delete(note);
    }
}
