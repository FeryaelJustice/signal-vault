package com.signalvault.common;

import java.time.Instant;
import java.util.List;

/**
 * Uniform error response body:
 * {timestamp, status, error, message, path}
 * plus an optional list of field validation errors.
 */
public record ApiError(
        Instant timestamp,
        int status,
        String error,
        String message,
        String path,
        List<FieldValidationError> fieldErrors
) {
    public ApiError(Instant timestamp, int status, String error, String message, String path) {
        this(timestamp, status, error, message, path, null);
    }

    public record FieldValidationError(String field, String message) {
    }
}
