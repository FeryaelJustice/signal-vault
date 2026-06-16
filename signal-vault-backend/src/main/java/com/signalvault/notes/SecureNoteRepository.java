package com.signalvault.notes;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface SecureNoteRepository extends JpaRepository<SecureNote, UUID> {

    List<SecureNote> findByOwnerIdOrderByUpdatedAtDesc(UUID ownerId);

    Optional<SecureNote> findByIdAndOwnerId(UUID id, UUID ownerId);
}
