package com.signalvault.notes;

import com.signalvault.notes.dto.NoteRequest;
import com.signalvault.notes.dto.NoteResponse;
import com.signalvault.security.AuthenticatedUser;
import com.signalvault.security.CurrentUser;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/notes")
@Tag(name = "Notes", description = "Secure notes (server stores client-side ciphertext only)")
@SecurityRequirement(name = "bearerAuth")
public class NoteController {

    private final NoteService noteService;

    public NoteController(NoteService noteService) {
        this.noteService = noteService;
    }

    @Operation(summary = "List the current user's notes")
    @GetMapping
    public List<NoteResponse> list(@CurrentUser AuthenticatedUser user) {
        return noteService.listForOwner(user.id()).stream()
                .map(NoteResponse::from)
                .toList();
    }

    @Operation(summary = "Create a note")
    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public NoteResponse create(@CurrentUser AuthenticatedUser user,
                               @Valid @RequestBody NoteRequest request) {
        return NoteResponse.from(
                noteService.create(user.id(), request.title(), request.encryptedContent(), request.highSecurity()));
    }

    @Operation(summary = "Update a note (must be owned by the caller)")
    @PutMapping("/{id}")
    public NoteResponse update(@CurrentUser AuthenticatedUser user,
                               @PathVariable UUID id,
                               @Valid @RequestBody NoteRequest request) {
        return NoteResponse.from(
                noteService.update(user.id(), id, request.title(), request.encryptedContent(), request.highSecurity()));
    }

    @Operation(summary = "Delete a note (must be owned by the caller)")
    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@CurrentUser AuthenticatedUser user,
                                       @PathVariable UUID id) {
        noteService.delete(user.id(), id);
        return ResponseEntity.noContent().build();
    }
}
