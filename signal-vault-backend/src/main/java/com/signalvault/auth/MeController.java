package com.signalvault.auth;

import com.signalvault.auth.dto.UserResponse;
import com.signalvault.common.NotFoundException;
import com.signalvault.security.AuthenticatedUser;
import com.signalvault.security.CurrentUser;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/me")
@Tag(name = "Account", description = "Current user information")
public class MeController {

    private final UserRepository userRepository;

    public MeController(UserRepository userRepository) {
        this.userRepository = userRepository;
    }

    @Operation(summary = "Get the currently authenticated user")
    @GetMapping
    public UserResponse me(@CurrentUser AuthenticatedUser user) {
        return userRepository.findById(user.id())
                .map(UserResponse::from)
                .orElseThrow(() -> new NotFoundException("User not found"));
    }
}
