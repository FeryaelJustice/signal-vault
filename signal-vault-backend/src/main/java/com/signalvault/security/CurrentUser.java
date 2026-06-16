package com.signalvault.security;

import java.lang.annotation.ElementType;
import java.lang.annotation.Retention;
import java.lang.annotation.RetentionPolicy;
import java.lang.annotation.Target;

import org.springframework.security.core.annotation.AuthenticationPrincipal;

/**
 * Resolves the {@link AuthenticatedUser} from the SecurityContext into a controller parameter.
 * Usage: {@code public X handler(@CurrentUser AuthenticatedUser user) { ... }}
 */
@Target(ElementType.PARAMETER)
@Retention(RetentionPolicy.RUNTIME)
@AuthenticationPrincipal
public @interface CurrentUser {
}
