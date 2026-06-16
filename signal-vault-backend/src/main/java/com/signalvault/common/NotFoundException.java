package com.signalvault.common;

/** Thrown when a requested resource does not exist or is not visible to the caller. */
public class NotFoundException extends RuntimeException {

    public NotFoundException(String message) {
        super(message);
    }
}
